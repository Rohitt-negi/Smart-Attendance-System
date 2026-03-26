#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Create directories
mkdir -p known_faces

# Download face detection models if they don't exist
# We download them during build so they are ready on startup
if [ ! -f "deploy.prototxt" ]; then
    echo "📥 Downloading deploy.prototxt..."
    curl -L "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt" -o deploy.prototxt
fi

if [ ! -f "res10_300x300_ssd_iter_140000.caffemodel" ]; then
    echo "📥 Downloading res10_300x300_ssd_iter_140000.caffemodel..."
    curl -L "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel" -o res10_300x300_ssd_iter_140000.caffemodel
fi

echo "✅ Build complete!"
