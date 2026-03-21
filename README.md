# SmartAttend - AI Face Recognition Attendance System

A smart attendance dashboard powered by **face recognition AI** with a **Python Flask backend** and a modern web frontend.

![SmartAttend](https://img.shields.io/badge/AI-Face%20Recognition-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-Flask-yellow?style=for-the-badge)

## Features

- **Face Registration** — Capture 3 face samples per student via webcam
- **Live Recognition** — Real-time face detection with automatic attendance marking
- **Dashboard** — Statistics, charts, and activity feed
- **Records** — Filterable attendance table with CSV export
- **Student Management** — View and manage registered students

## Architecture

```
Browser (HTML/CSS/JS)  ←──REST API──→  Python Flask Backend
  ├─ Webcam capture                      ├─ OpenCV DNN (SSD ResNet-10)
  ├─ UI/Dashboard                        ├─ Face embedding extraction
  ├─ Chart.js charts                     ├─ Cosine similarity matching
  └─ Camera module                       └─ SQLite database
```

## How It Works (ML Concepts)

### 1. Face Detection — OpenCV DNN (SSD ResNet-10)
- Uses **Single Shot Detector** with ResNet-10 backbone
- Pre-trained Caffe model, auto-downloaded on first run
- Detects face bounding boxes with confidence scores

### 2. Face Embedding — HOG + Histogram Features
- Extracts **multi-feature embedding vector** from each detected face:
  - Pixel intensity histogram (64 bins)
  - Spatial structure (16×16 resize)
  - HOG-like gradient features (9 orientation bins × 16 cells)
  - HSV color histogram
- Creates a robust feature vector for identity comparison

### 3. Face Matching — Cosine Similarity
- Compares detected face embeddings against stored embeddings
- Uses **cosine similarity** as the metric (0 to 1)
- Match threshold: > 0.75

## Setup

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Start the server
python3 app.py

# 3. Open in browser
# Navigate to http://localhost:5000
```

The face detection model (~10MB) will auto-download on first run.

## Usage

1. **Register Students**: Register tab → Fill details → Start camera → Capture 3 face photos → Submit
2. **Mark Attendance**: Mark Attendance tab → Start Recognition → Faces auto-detected and matched
3. **View Records**: Records tab → Filter by date → Export CSV
4. **Dashboard**: Real-time stats and charts

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python + Flask |
| Face Detection | OpenCV DNN (SSD ResNet-10) |
| Face Matching | NumPy (Cosine Similarity) |
| Database | SQLite |
| Frontend | HTML + CSS + JavaScript |
| Charts | Chart.js |
| Styling | Custom CSS (Dark Glassmorphism) |

## Project Structure

```
Attendence/
├── app.py                  # Flask backend + face recognition
├── requirements.txt        # Python dependencies
├── attendance.db           # SQLite database (auto-created)
├── known_faces/            # Face image storage
├── templates/
│   └── index.html          # Main web page
├── static/
│   ├── css/
│   │   └── styles.css      # Dark theme design system
│   └── js/
│       ├── api.js           # API layer (fetch calls to Flask)
│       ├── camera.js        # Webcam handling
│       ├── app.js           # App controller + navigation
│       ├── dashboard.js     # Stats + charts
│       ├── register.js      # Student registration
│       ├── attendance.js    # Live recognition
│       ├── records.js       # Records + CSV export
│       └── students.js      # Student management
└── README.md
```
