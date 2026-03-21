/* =====================================================
   Camera Module - Webcam handling (browser side only)
   Face processing is done by the Python backend
   ===================================================== */

const Camera = (() => {

    // Start webcam stream
    async function start(videoElement) {
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
            throw new Error('Camera access denied. Please allow camera permissions.');
        }
    }

    // Stop webcam stream
    function stop(videoElement) {
        if (videoElement && videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    }

    // Capture current video frame as base64 JPEG
    function captureFrame(videoElement, quality = 0.8) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);
        return canvas.toDataURL('image/jpeg', quality);
    }

    // Capture a smaller frame for faster recognition (sent to backend)
    function captureSmallFrame(videoElement) {
        const canvas = document.createElement('canvas');
        // Resize to 320x240 for faster backend processing
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, 320, 240);
        return canvas.toDataURL('image/jpeg', 0.7);
    }

    // Draw face detection boxes on canvas (results come from Python backend)
    function drawDetections(canvas, videoElement, faces) {
        const ctx = canvas.getContext('2d');
        const displayW = canvas.clientWidth;
        const displayH = canvas.clientHeight;
        canvas.width = displayW;
        canvas.height = displayH;

        ctx.clearRect(0, 0, displayW, displayH);

        if (!faces || faces.length === 0) return;

        // The backend returns coordinates based on the image it received
        // We need to scale to canvas display size
        const scaleX = displayW / videoElement.videoWidth;
        const scaleY = displayH / videoElement.videoHeight;

        // Mirror horizontally (video is mirrored via CSS)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-displayW, 0);

        faces.forEach(face => {
            const box = face.box;
            const x = box.left * scaleX;
            const y = box.top * scaleY;
            const w = (box.right - box.left) * scaleX;
            const h = (box.bottom - box.top) * scaleY;

            const isKnown = face.matched;

            // Main box
            ctx.strokeStyle = isKnown ? '#10b981' : '#ef4444';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);

            // Corner accents
            const cornerLen = 15;
            ctx.strokeStyle = isKnown ? '#10b981' : '#3b82f6';
            ctx.lineWidth = 4;

            // Top-left
            ctx.beginPath();
            ctx.moveTo(x, y + cornerLen);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerLen, y);
            ctx.stroke();

            // Top-right
            ctx.beginPath();
            ctx.moveTo(x + w - cornerLen, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + cornerLen);
            ctx.stroke();

            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(x, y + h - cornerLen);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x + cornerLen, y + h);
            ctx.stroke();

            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(x + w - cornerLen, y + h);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w, y + h - cornerLen);
            ctx.stroke();

            // Label
            const label = isKnown
                ? `${face.name} (${face.confidence}%)`
                : 'Unknown';

            ctx.font = 'bold 13px Inter, sans-serif';
            const textW = ctx.measureText(label).width;

            ctx.fillStyle = isKnown
                ? 'rgba(16, 185, 129, 0.85)'
                : 'rgba(239, 68, 68, 0.85)';
            ctx.beginPath();
            ctx.roundRect(x, y - 28, textW + 16, 24, 6);
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.fillText(label, x + 8, y - 11);
        });

        ctx.restore();
    }

    return { start, stop, captureFrame, captureSmallFrame, drawDetections };
})();
