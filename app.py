"""
SmartAttend - Flask Backend
Face Recognition Attendance System
Uses: OpenCV DNN (face detection) + NumPy (face comparison), Flask, SQLite
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import sqlite3
import os
import base64
import json
from io import BytesIO
from PIL import Image
from datetime import datetime, date, timedelta

app = Flask(__name__)
CORS(app)

# ─── Configuration ───
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attendance.db')
FACES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'known_faces')
os.makedirs(FACES_DIR, exist_ok=True)

# ─── Face Detection with OpenCV DNN ───
# Download the Caffe model files for face detection
PROTO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'deploy.prototxt')
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'res10_300x300_ssd_iter_140000.caffemodel')

face_net = None


def download_face_model():
    """Download OpenCV's pre-trained face detection model if not present."""
    import urllib.request
    import ssl

    # Bypass SSL verification for model download (common issue on macOS Python)
    context = ssl._create_unverified_context()

    if not os.path.exists(PROTO_PATH):
        print("📥 Downloading face detection model (prototxt)...")
        url = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
        with urllib.request.urlopen(url, context=context) as response, open(PROTO_PATH, 'wb') as out_file:
            out_file.write(response.read())

    if not os.path.exists(MODEL_PATH):
        print("📥 Downloading face detection model (caffemodel ~10MB)...")
        url = "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"
        with urllib.request.urlopen(url, context=context) as response, open(MODEL_PATH, 'wb') as out_file:
            out_file.write(response.read())


def load_face_net():
    """Load the OpenCV DNN face detector."""
    global face_net
    download_face_model()
    face_net = cv2.dnn.readNetFromCaffe(PROTO_PATH, MODEL_PATH)
    print("✅ Face detection model loaded (SSD ResNet-10)")


def detect_faces(image):
    """
    Detect faces using OpenCV DNN SSD model.
    Returns list of (x1, y1, x2, y2, confidence) tuples.
    """
    h, w = image.shape[:2]
    blob = cv2.dnn.blobFromImage(
        cv2.resize(image, (300, 300)),
        1.0, (300, 300),
        (104.0, 177.0, 123.0)
    )
    face_net.setInput(blob)
    detections = face_net.forward()

    faces = []
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence > 0.5:
            box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
            x1, y1, x2, y2 = box.astype("int")
            # Clamp to image bounds
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            if x2 > x1 and y2 > y1:
                faces.append((x1, y1, x2, y2, float(confidence)))

    return faces


def extract_face_embedding(image, face_box):
    """
    Extract a face embedding using a histogram + resize approach.
    This creates a feature vector from the face region for comparison.
    Uses LBP (Local Binary Pattern) inspired histogram features.
    """
    x1, y1, x2, y2 = face_box[:4]
    face_roi = image[y1:y2, x1:x2]

    if face_roi.size == 0:
        return None

    # Resize face to standard size
    face_resized = cv2.resize(face_roi, (128, 128))

    # Convert to grayscale
    gray = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)

    # Method: Combine multiple feature extraction approaches for a robust embedding

    # 1. Histogram of pixel intensities (normalized)
    hist = cv2.calcHist([gray], [0], None, [64], [0, 256])
    hist = cv2.normalize(hist, hist).flatten()

    # 2. Resize to small dimensions and flatten (captures spatial structure)
    small = cv2.resize(gray, (16, 16)).flatten().astype(np.float64)
    small = small / (np.linalg.norm(small) + 1e-7)

    # 3. HOG-like gradient features
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(gx ** 2 + gy ** 2)
    angle = np.arctan2(gy, gx) * 180 / np.pi + 180

    # Create gradient histogram (9 orientation bins, 4x4 spatial cells)
    grad_features = []
    cell_h, cell_w = 32, 32
    for cy in range(0, 128, cell_h):
        for cx in range(0, 128, cell_w):
            cell_mag = magnitude[cy:cy + cell_h, cx:cx + cell_w]
            cell_ang = angle[cy:cy + cell_h, cx:cx + cell_w]
            hist_grad, _ = np.histogram(cell_ang, bins=9, range=(0, 360), weights=cell_mag)
            grad_features.extend(hist_grad)
    grad_features = np.array(grad_features, dtype=np.float64)
    grad_norm = np.linalg.norm(grad_features)
    if grad_norm > 0:
        grad_features = grad_features / grad_norm

    # 4. Color histogram (if color image)
    color_hist = []
    face_hsv = cv2.cvtColor(face_resized, cv2.COLOR_BGR2HSV)
    for ch in range(3):
        h = cv2.calcHist([face_hsv], [ch], None, [16], [0, 256])
        h = cv2.normalize(h, h).flatten()
        color_hist.extend(h)
    color_hist = np.array(color_hist, dtype=np.float64)

    # Concatenate all features into one embedding vector
    embedding = np.concatenate([hist, small, grad_features, color_hist])

    return embedding.tolist()


def compare_embeddings(emb1, emb2):
    """
    Compare two face embeddings using cosine similarity.
    Returns similarity score (0 to 1, higher = more similar).
    """
    a = np.array(emb1)
    b = np.array(emb2)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


# ─── Database Helpers ───

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            roll_number TEXT UNIQUE NOT NULL,
            department TEXT NOT NULL,
            photo TEXT,
            face_encoding TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            student_name TEXT NOT NULL,
            roll_number TEXT NOT NULL,
            department TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT DEFAULT 'Present',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id),
            UNIQUE(student_id, date)
        )
    ''')
    conn.commit()
    conn.close()
    print("✅ Database initialized")


# ─── Helper: decode base64 image ───

def decode_image(photo_b64):
    """Decode a base64 image to numpy array (BGR for OpenCV)."""
    if ',' in photo_b64:
        photo_b64 = photo_b64.split(',')[1]
    image_data = base64.b64decode(photo_b64)
    image = Image.open(BytesIO(image_data)).convert('RGB')
    image_np = np.array(image)
    # Convert RGB to BGR for OpenCV
    return cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)


# ─── Routes: Pages ───

@app.route('/')
def index():
    return render_template('index.html')


# ─── Routes: Students API ───

@app.route('/api/students', methods=['GET'])
def get_students():
    conn = get_db()
    students = conn.execute(
        'SELECT id, name, roll_number, department, photo, created_at FROM students'
    ).fetchall()
    conn.close()
    return jsonify([dict(s) for s in students])


@app.route('/api/students', methods=['POST'])
def register_student():
    data = request.json
    name = data.get('name', '').strip()
    roll_number = data.get('rollNumber', '').strip()
    department = data.get('department', '').strip()
    photos = data.get('photos', [])

    if not all([name, roll_number, department]):
        return jsonify({'error': 'Name, roll number, and department are required'}), 400
    if len(photos) < 1:
        return jsonify({'error': 'At least one face photo is required'}), 400

    conn = get_db()
    existing = conn.execute('SELECT id FROM students WHERE roll_number = ?', (roll_number,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'A student with this roll number already exists'}), 409

    # Extract face embeddings from photos
    embeddings = []
    for photo_b64 in photos:
        try:
            image = decode_image(photo_b64)
            faces = detect_faces(image)
            if len(faces) > 0:
                embedding = extract_face_embedding(image, faces[0])
                if embedding:
                    embeddings.append(embedding)
        except Exception as e:
            print(f"⚠️ Error processing photo: {e}")

    if len(embeddings) == 0:
        conn.close()
        return jsonify({'error': 'No face detected in the photos. Please try again with clearer images.'}), 400

    # Average embedding for better accuracy
    avg_embedding = np.mean(embeddings, axis=0).tolist()

    conn.execute(
        'INSERT INTO students (name, roll_number, department, photo, face_encoding) VALUES (?, ?, ?, ?, ?)',
        (name, roll_number, department, photos[0], json.dumps(avg_embedding))
    )
    conn.commit()
    conn.close()

    print(f"✅ Registered: {name} ({roll_number}) with {len(embeddings)} face samples")
    return jsonify({
        'message': f'{name} registered successfully!',
        'encodings_count': len(embeddings)
    }), 201


@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    conn = get_db()
    student = conn.execute('SELECT name FROM students WHERE id = ?', (student_id,)).fetchone()
    if not student:
        conn.close()
        return jsonify({'error': 'Student not found'}), 404

    conn.execute('DELETE FROM attendance WHERE student_id = ?', (student_id,))
    conn.execute('DELETE FROM students WHERE id = ?', (student_id,))
    conn.commit()
    conn.close()

    print(f"🗑️ Deleted student: {student['name']}")
    return jsonify({'message': 'Student deleted successfully'})


# ─── Routes: Face Recognition API ───

@app.route('/api/recognize', methods=['POST'])
def recognize_faces_route():
    data = request.json
    photo_b64 = data.get('photo', '')

    if not photo_b64:
        return jsonify({'faces': [], 'count': 0})

    try:
        image = decode_image(photo_b64)
    except Exception as e:
        return jsonify({'error': f'Invalid image: {e}'}), 400

    # Detect faces
    face_detections = detect_faces(image)

    # Load known faces
    conn = get_db()
    students = conn.execute(
        'SELECT id, name, roll_number, department, face_encoding FROM students WHERE face_encoding IS NOT NULL'
    ).fetchall()
    conn.close()

    known_students = []
    known_embeddings = []
    for s in students:
        try:
            emb = json.loads(s['face_encoding'])
            known_embeddings.append(emb)
            known_students.append(dict(s))
        except:
            continue

    # Match each detected face
    results = []
    h, w = image.shape[:2]
    for face_box in face_detections:
        x1, y1, x2, y2, conf = face_box

        face_data = {
            'box': {'top': int(y1), 'right': int(x2), 'bottom': int(y2), 'left': int(x1)}
        }

        if len(known_embeddings) > 0:
            embedding = extract_face_embedding(image, face_box)
            if embedding:
                # Compare with all known faces
                best_similarity = 0
                best_idx = -1
                for idx, known_emb in enumerate(known_embeddings):
                    similarity = compare_embeddings(embedding, known_emb)
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_idx = idx

                if best_similarity > 0.75 and best_idx >= 0:  # Threshold for match
                    student = known_students[best_idx]
                    face_data.update({
                        'studentId': student['id'],
                        'name': student['name'],
                        'rollNumber': student['roll_number'],
                        'department': student['department'],
                        'confidence': round(best_similarity * 100, 1),
                        'matched': True
                    })
                else:
                    face_data.update({'name': 'Unknown', 'confidence': 0, 'matched': False})
            else:
                face_data.update({'name': 'Unknown', 'confidence': 0, 'matched': False})
        else:
            face_data.update({'name': 'Unknown', 'confidence': 0, 'matched': False})

        results.append(face_data)

    return jsonify({'faces': results, 'count': len(face_detections)})


# ─── Routes: Attendance API ───

@app.route('/api/attendance', methods=['POST'])
def mark_attendance():
    data = request.json
    student_id = data.get('studentId')

    if not student_id:
        return jsonify({'error': 'Student ID is required'}), 400

    conn = get_db()
    student = conn.execute('SELECT * FROM students WHERE id = ?', (student_id,)).fetchone()
    if not student:
        conn.close()
        return jsonify({'error': 'Student not found'}), 404

    today_str = date.today().isoformat()

    existing = conn.execute(
        'SELECT id FROM attendance WHERE student_id = ? AND date = ?',
        (student_id, today_str)
    ).fetchone()

    if existing:
        conn.close()
        return jsonify({'message': 'Already marked today', 'alreadyMarked': True})

    now = datetime.now()
    conn.execute(
        'INSERT INTO attendance (student_id, student_name, roll_number, department, date, time) VALUES (?, ?, ?, ?, ?, ?)',
        (student_id, student['name'], student['roll_number'], student['department'],
         today_str, now.strftime('%I:%M:%S %p'))
    )
    conn.commit()
    conn.close()

    print(f"📋 Attendance: {student['name']} marked present at {now.strftime('%I:%M %p')}")
    return jsonify({
        'message': f"{student['name']} marked present!",
        'alreadyMarked': False
    }), 201


@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    date_filter = request.args.get('date')
    search = request.args.get('search', '').lower().strip()

    conn = get_db()

    if date_filter:
        students = conn.execute('SELECT * FROM students').fetchall()
        attended = conn.execute('SELECT * FROM attendance WHERE date = ?', (date_filter,)).fetchall()
        attended_map = {a['student_id']: dict(a) for a in attended}

        records = []
        for s in students:
            if s['id'] in attended_map:
                a = attended_map[s['id']]
                records.append({
                    'rollNumber': s['roll_number'], 'name': s['name'],
                    'department': s['department'], 'date': date_filter,
                    'time': a['time'], 'status': 'Present'
                })
            else:
                records.append({
                    'rollNumber': s['roll_number'], 'name': s['name'],
                    'department': s['department'], 'date': date_filter,
                    'time': '-', 'status': 'Absent'
                })
    else:
        all_records = conn.execute('SELECT * FROM attendance ORDER BY timestamp DESC').fetchall()
        records = [{
            'rollNumber': r['roll_number'], 'name': r['student_name'],
            'department': r['department'], 'date': r['date'],
            'time': r['time'], 'status': r['status']
        } for r in all_records]

    conn.close()

    if search:
        records = [r for r in records if search in r['name'].lower() or search in r['rollNumber'].lower()]

    return jsonify(records)


@app.route('/api/attendance/today', methods=['GET'])
def get_today_attendance():
    today_str = date.today().isoformat()
    conn = get_db()
    records = conn.execute(
        'SELECT * FROM attendance WHERE date = ? ORDER BY timestamp DESC', (today_str,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])


# ─── Routes: Dashboard Stats ───

@app.route('/api/stats', methods=['GET'])
def get_stats():
    today_str = date.today().isoformat()
    conn = get_db()

    total = conn.execute('SELECT COUNT(*) FROM students').fetchone()[0]
    present = conn.execute('SELECT COUNT(*) FROM attendance WHERE date = ?', (today_str,)).fetchone()[0]
    absent = total - present
    rate = round((present / total) * 100) if total > 0 else 0

    weekly = []
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        count = conn.execute('SELECT COUNT(*) FROM attendance WHERE date = ?', (d.isoformat(),)).fetchone()[0]
        weekly.append({'date': d.isoformat(), 'label': d.strftime('%a'), 'count': count})

    recent = conn.execute('SELECT * FROM attendance ORDER BY timestamp DESC LIMIT 10').fetchall()
    conn.close()

    return jsonify({
        'total': total, 'present': present, 'absent': absent, 'rate': rate,
        'weekly': weekly, 'recent': [dict(r) for r in recent]
    })


# ─── Main ───

if __name__ == '__main__':
    init_db()
    load_face_net()
    print("=" * 50)
    print("🧠 SmartAttend - AI Face Recognition System")
    print("   Backend: Python + OpenCV DNN + Flask")
    print("=" * 50)
    print(f"📂 Database: {DB_PATH}")
    print(f"🌐 Server: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
