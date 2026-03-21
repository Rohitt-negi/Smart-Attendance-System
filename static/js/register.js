/* =====================================================
   Register Module - Student Registration with Webcam
   Photos sent to Python backend for face encoding
   ===================================================== */

const Register = (() => {
    let stream = null;
    let capturedPhotos = [];

    const video = () => document.getElementById('registerVideo');
    const overlay = () => document.getElementById('registerOverlay');
    const placeholder = () => document.getElementById('registerPlaceholder');
    const captureBtn = () => document.getElementById('captureFace');
    const countEl = () => document.getElementById('captureCount');
    const previews = () => document.getElementById('capturedPreviews');
    const registerBtn = () => document.getElementById('registerBtn');
    const form = () => document.getElementById('registerForm');

    function init() {
        document.getElementById('startRegisterCam').addEventListener('click', startCamera);
        captureBtn().addEventListener('click', captureFace);
        form().addEventListener('submit', handleRegister);
    }

    async function startCamera() {
        try {
            stream = await Camera.start(video());
            placeholder().classList.add('hidden');
            captureBtn().disabled = false;
            App.toast('Camera started! Position your face and capture.', 'info');
        } catch (error) {
            App.toast(error.message, 'error');
        }
    }

    function captureFace() {
        if (capturedPhotos.length >= 3) return;

        const photo = Camera.captureFrame(video());
        capturedPhotos.push(photo);

        const count = capturedPhotos.length;
        countEl().textContent = count;

        // Add preview
        const thumb = document.createElement('div');
        thumb.className = 'capture-thumb';
        thumb.innerHTML = `<img src="${photo}" alt="Face sample ${count}">`;
        previews().appendChild(thumb);

        App.toast(`Face sample ${count}/3 captured!`, 'success');

        if (count >= 3) {
            captureBtn().disabled = true;
            updateRegisterButton();
            App.toast('All 3 samples captured! Fill details and register.', 'success');
        }
    }

    function updateRegisterButton() {
        const name = document.getElementById('studentName').value.trim();
        const roll = document.getElementById('rollNumber').value.trim();
        const dept = document.getElementById('department').value;
        registerBtn().disabled = !(name && roll && dept && capturedPhotos.length >= 3);
    }

    async function handleRegister(e) {
        e.preventDefault();

        const name = document.getElementById('studentName').value.trim();
        const roll = document.getElementById('rollNumber').value.trim();
        const dept = document.getElementById('department').value;

        if (capturedPhotos.length < 3) {
            App.toast('Please capture 3 face samples first!', 'warning');
            return;
        }

        registerBtn().disabled = true;
        registerBtn().innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing with Python...';

        try {
            const result = await API.registerStudent(name, roll, dept, capturedPhotos);
            App.toast(result.message, 'success');
            resetForm();
            Dashboard.refresh();
        } catch (error) {
            App.toast(error.message, 'error');
            registerBtn().disabled = false;
            registerBtn().innerHTML = '<i class="fas fa-save"></i> Register Student';
        }
    }

    function resetForm() {
        form().reset();
        capturedPhotos = [];
        countEl().textContent = '0';
        previews().innerHTML = '';
        registerBtn().disabled = true;
        registerBtn().innerHTML = '<i class="fas fa-save"></i> Register Student';
        captureBtn().disabled = true;
    }

    function cleanup() {
        Camera.stop(video());
        stream = null;
        placeholder().classList.remove('hidden');
    }

    function setupFormListeners() {
        ['studentName', 'rollNumber', 'department'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateRegisterButton);
            document.getElementById(id).addEventListener('change', updateRegisterButton);
        });
    }

    return { init, cleanup, setupFormListeners };
})();
