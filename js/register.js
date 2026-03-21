/* =====================================================
   Register Module - Student Registration with Webcam
   ===================================================== */

const Register = (() => {
    let stream = null;
    let capturedDescriptors = [];
    let capturedPhotos = [];

    const video = () => document.getElementById('registerVideo');
    const overlay = () => document.getElementById('registerOverlay');
    const placeholder = () => document.getElementById('registerPlaceholder');
    const captureBtn = () => document.getElementById('captureFace');
    const captureCount = () => document.getElementById('captureCount');
    const previews = () => document.getElementById('capturedPreviews');
    const registerBtn = () => document.getElementById('registerBtn');
    const form = () => document.getElementById('registerForm');

    function init() {
        document.getElementById('startRegisterCam').addEventListener('click', startCamera);
        captureBtn().addEventListener('click', captureFace);
        form().addEventListener('submit', handleRegister);
    }

    async function startCamera() {
        if (!FaceRecognition.isReady()) {
            App.toast('AI models still loading, please wait...', 'warning');
            return;
        }

        try {
            stream = await FaceRecognition.startCamera(video());
            placeholder().classList.add('hidden');

            // Set overlay size
            const v = video();
            overlay().width = v.videoWidth;
            overlay().height = v.videoHeight;

            // Start face detection preview
            detectLoop();

            App.toast('Camera started! Position your face in frame.', 'info');
        } catch (error) {
            App.toast(error.message, 'error');
        }
    }

    async function detectLoop() {
        if (!stream) return;

        const v = video();
        const o = overlay();
        const displaySize = { width: o.clientWidth, height: o.clientHeight };

        // Resize overlay to match displayed video
        faceapi.matchDimensions(o, displaySize);

        const detection = await FaceRecognition.detectSingleFace(v);

        if (detection) {
            const resized = faceapi.resizeResults(detection, displaySize);
            FaceRecognition.drawDetections(o, [resized], displaySize, ['Position Face']);
            captureBtn().disabled = false;
        } else {
            const ctx = o.getContext('2d');
            ctx.clearRect(0, 0, o.width, o.height);
            captureBtn().disabled = capturedDescriptors.length >= 3;
        }

        if (stream) {
            requestAnimationFrame(detectLoop);
        }
    }

    async function captureFace() {
        if (capturedDescriptors.length >= 3) return;

        const v = video();
        const descriptor = await FaceRecognition.captureFaceDescriptor(v);

        if (!descriptor) {
            App.toast('No face detected! Ensure your face is clearly visible.', 'error');
            return;
        }

        // Save descriptor and photo
        capturedDescriptors.push(descriptor);
        const photo = FaceRecognition.capturePhoto(v);
        capturedPhotos.push(photo);

        // Update UI
        const count = capturedDescriptors.length;
        captureCount().textContent = count;

        // Add preview thumbnail
        const thumb = document.createElement('div');
        thumb.className = 'capture-thumb';
        thumb.innerHTML = `<img src="${photo}" alt="Face sample ${count}">`;
        previews().appendChild(thumb);

        App.toast(`Face sample ${count}/3 captured!`, 'success');

        if (count >= 3) {
            captureBtn().disabled = true;
            updateRegisterButton();
            App.toast('All face samples captured! Fill details and register.', 'success');
        }
    }

    function updateRegisterButton() {
        const name = document.getElementById('studentName').value.trim();
        const roll = document.getElementById('rollNumber').value.trim();
        const dept = document.getElementById('department').value;
        registerBtn().disabled = !(name && roll && dept && capturedDescriptors.length >= 3);
    }

    async function handleRegister(e) {
        e.preventDefault();

        const name = document.getElementById('studentName').value.trim();
        const roll = document.getElementById('rollNumber').value.trim();
        const dept = document.getElementById('department').value;

        if (capturedDescriptors.length < 3) {
            App.toast('Please capture 3 face samples first!', 'warning');
            return;
        }

        // Check for duplicate roll number
        const existing = await DB.getStudentByRoll(roll);
        if (existing) {
            App.toast('A student with this roll number already exists!', 'error');
            return;
        }

        try {
            const student = {
                name,
                rollNumber: roll,
                department: dept,
                faceDescriptors: capturedDescriptors,
                photo: capturedPhotos[0] // Store first photo as profile
            };

            await DB.addStudent(student);
            await FaceRecognition.buildLabeledDescriptors();

            App.toast(`Student "${name}" registered successfully!`, 'success');
            resetForm();

            // Refresh dashboard if visible
            Dashboard.refresh();
        } catch (error) {
            console.error('Registration error:', error);
            App.toast('Registration failed. Please try again.', 'error');
        }
    }

    function resetForm() {
        form().reset();
        capturedDescriptors = [];
        capturedPhotos = [];
        captureCount().textContent = '0';
        previews().innerHTML = '';
        registerBtn().disabled = true;
        captureBtn().disabled = true;
    }

    function cleanup() {
        FaceRecognition.stopCamera(video());
        stream = null;
        const o = overlay();
        if (o) {
            const ctx = o.getContext('2d');
            ctx.clearRect(0, 0, o.width, o.height);
        }
        placeholder().classList.remove('hidden');
    }

    // Listen for form input changes to enable register button
    function setupFormListeners() {
        ['studentName', 'rollNumber', 'department'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateRegisterButton);
            document.getElementById(id).addEventListener('change', updateRegisterButton);
        });
    }

    return { init, cleanup, setupFormListeners };
})();
