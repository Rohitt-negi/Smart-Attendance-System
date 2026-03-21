# SmartAttend - AI Face Recognition Attendance System

A smart attendance dashboard powered by **face recognition AI** that runs entirely in your browser. Built using **face-api.js** (TensorFlow.js) for real-time face detection and recognition.

![SmartAttend](https://img.shields.io/badge/AI-Face%20Recognition-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Working-green?style=for-the-badge)

## Features

- **Face Registration** — Capture 3 face samples per student via webcam
- **Live Recognition** — Real-time face detection with automatic attendance marking
- **Dashboard** — Statistics, charts, and activity feed
- **Records** — Filterable attendance table with CSV export
- **Student Management** — View and manage registered students

## How It Works (ML Concepts)

### 1. Face Detection — SSD MobileNet v1
- Uses **Single Shot Multibox Detector** with MobileNet v1 backbone
- Detects face bounding boxes in real-time from webcam feed
- Confidence threshold: 0.5

### 2. Face Landmarks — 68-Point Model
- Detects 68 facial landmark points (eyes, nose, mouth, jawline)
- Used to align faces before computing descriptors

### 3. Face Recognition — 128-Dimensional Embeddings
- Each face is converted to a **128-dimensional feature vector** (descriptor)
- These embeddings capture unique facial characteristics
- Multiple samples (3) per student improve accuracy

### 4. Face Matching — Euclidean Distance
- Compares detected face descriptors against stored descriptors
- Uses **Euclidean distance** as similarity metric
- Threshold ≤ 0.6 for positive match (lower = more similar)

## Setup

### 1. Start a Local Server
The app needs to be served via HTTP (not file://) for webcam and model loading:

```bash
# Using Python (recommended)
cd Attendence
python3 -m http.server 8080

# Or using Node.js
npx -y serve .
```

### 2. Open in Browser
Navigate to `http://localhost:8080`

### 3. Allow Camera Access
Click "Allow" when prompted for camera permissions.

## Usage

1. **Register Students** — Go to Register tab → Fill details → Start camera → Capture 3 face samples → Submit
2. **Mark Attendance** — Go to Mark Attendance → Start Recognition → Students are automatically marked present when recognized
3. **View Records** — Check Records tab to see attendance logs, filter by date, export CSV
4. **Dashboard** — View real-time stats and charts

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Face Detection | face-api.js (SSD MobileNet v1) |
| Face Recognition | face-api.js (128-dim embeddings) |
| Charts | Chart.js |
| Storage | IndexedDB (browser) |
| Styling | Custom CSS (Dark Glassmorphism) |
| Icons | Font Awesome 6 |
| Fonts | Inter (Google Fonts) |

## Browser Compatibility

- Chrome 80+ ✅
- Firefox 78+ ✅
- Edge 80+ ✅
- Safari 14+ ✅

## Project Structure

```
Attendence/
├── index.html              # Main application
├── README.md               # This file
├── css/
│   └── styles.css          # Dark theme design system
└── js/
    ├── app.js              # App controller & navigation
    ├── db.js               # IndexedDB persistence layer
    ├── faceRecognition.js  # face-api.js integration
    ├── dashboard.js        # Stats & Chart.js charts
    ├── register.js         # Student registration + webcam
    ├── attendance.js       # Live recognition engine
    ├── records.js          # Records table & CSV export
    └── students.js         # Student management
```

## License

MIT — Built as an ML project demonstration.
