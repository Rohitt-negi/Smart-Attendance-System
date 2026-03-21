/* =====================================================
   Face Recognition Module - face-api.js integration
   ===================================================== */

const FaceRecognition = (() => {
    // Model URL - using jsdelivr CDN for face-api.js weights
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

    let modelsLoaded = false;
    let labeledDescriptors = [];

    // Load face-api.js models
    async function loadModels(onProgress) {
        try {
            if (onProgress) onProgress(10);

            await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
            if (onProgress) onProgress(40);

            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            if (onProgress) onProgress(70);

            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            if (onProgress) onProgress(100);

            modelsLoaded = true;
            console.log('✅ Face recognition models loaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to load face models:', error);
            throw error;
        }
    }

    function isReady() {
        return modelsLoaded;
    }

    // Start webcam stream
    async function startCamera(videoElement) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            videoElement.srcObject = stream;
            return new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    videoElement.play();
                    resolve(stream);
                };
            });
        } catch (error) {
            console.error('Camera access error:', error);
            throw new Error('Camera access denied. Please allow camera access.');
        }
    }

    // Stop webcam stream
    function stopCamera(videoElement) {
        if (videoElement && videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    }

    // Detect single face and get descriptor
    async function detectSingleFace(input) {
        const detection = await faceapi
            .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        return detection;
    }

    // Detect all faces
    async function detectAllFaces(input) {
        const detections = await faceapi
            .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();
        return detections;
    }

    // Build labeled face descriptors from students database
    async function buildLabeledDescriptors() {
        const students = await DB.getAllStudents();
        labeledDescriptors = [];

        for (const student of students) {
            if (student.faceDescriptors && student.faceDescriptors.length > 0) {
                const descriptors = student.faceDescriptors.map(d =>
                    new Float32Array(d)
                );
                const labeled = new faceapi.LabeledFaceDescriptors(
                    String(student.id),
                    descriptors
                );
                labeledDescriptors.push(labeled);
            }
        }

        console.log(`Built ${labeledDescriptors.length} labeled descriptors`);
        return labeledDescriptors;
    }

    // Get face matcher
    function getFaceMatcher(threshold = 0.6) {
        if (labeledDescriptors.length === 0) {
            return null;
        }
        return new faceapi.FaceMatcher(labeledDescriptors, threshold);
    }

    // Draw detections on canvas
    function drawDetections(canvas, detections, displaySize, labels = null) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Mirror the canvas to match video
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        if (!detections || detections.length === 0) {
            ctx.restore();
            return;
        }

        detections.forEach((detection, i) => {
            const box = detection.detection ? detection.detection.box : detection.box;
            if (!box) return;

            const label = labels && labels[i] ? labels[i] : null;
            const isKnown = label && label !== 'unknown';

            // Draw box
            ctx.strokeStyle = isKnown ? '#10b981' : '#ef4444';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Corner accents
            const cornerLength = 15;
            ctx.strokeStyle = isKnown ? '#10b981' : '#3b82f6';
            ctx.lineWidth = 4;

            // Top-left
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + cornerLength);
            ctx.lineTo(box.x, box.y);
            ctx.lineTo(box.x + cornerLength, box.y);
            ctx.stroke();

            // Top-right
            ctx.beginPath();
            ctx.moveTo(box.x + box.width - cornerLength, box.y);
            ctx.lineTo(box.x + box.width, box.y);
            ctx.lineTo(box.x + box.width, box.y + cornerLength);
            ctx.stroke();

            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + box.height - cornerLength);
            ctx.lineTo(box.x, box.y + box.height);
            ctx.lineTo(box.x + cornerLength, box.y + box.height);
            ctx.stroke();

            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(box.x + box.width - cornerLength, box.y + box.height);
            ctx.lineTo(box.x + box.width, box.y + box.height);
            ctx.lineTo(box.x + box.width, box.y + box.height - cornerLength);
            ctx.stroke();

            // Label background
            if (label) {
                const text = isKnown ? label : 'Unknown';
                ctx.font = 'bold 14px Inter, sans-serif';
                const textWidth = ctx.measureText(text).width;
                const bgX = box.x;
                const bgY = box.y - 28;

                ctx.fillStyle = isKnown
                    ? 'rgba(16, 185, 129, 0.85)'
                    : 'rgba(239, 68, 68, 0.85)';
                ctx.beginPath();
                ctx.roundRect(bgX, bgY, textWidth + 16, 24, 6);
                ctx.fill();

                ctx.fillStyle = 'white';
                ctx.fillText(text, bgX + 8, bgY + 17);
            }
        });

        ctx.restore();
    }

    // Capture face descriptor from video
    async function captureFaceDescriptor(videoElement) {
        const detection = await detectSingleFace(videoElement);
        if (!detection) {
            return null;
        }
        return Array.from(detection.descriptor);
    }

    // Capture photo from video as data URL
    function capturePhoto(videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    return {
        loadModels,
        isReady,
        startCamera,
        stopCamera,
        detectSingleFace,
        detectAllFaces,
        buildLabeledDescriptors,
        getFaceMatcher,
        drawDetections,
        captureFaceDescriptor,
        capturePhoto
    };
})();
