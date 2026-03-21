/* =====================================================
   Attendance Module - Live Face Recognition
   Sends frames to Python backend for recognition
   ===================================================== */

const Attendance = (() => {
    let stream = null;
    let isRunning = false;
    let recognizedToday = new Set();
    let recognitionInterval = null;

    const video = () => document.getElementById('attendanceVideo');
    const overlay = () => document.getElementById('attendanceOverlay');
    const placeholder = () => document.getElementById('attendancePlaceholder');
    const startBtn = () => document.getElementById('startAttendanceCam');
    const stopBtn = () => document.getElementById('stopAttendanceCam');
    const listEl = () => document.getElementById('recognizedList');

    function init() {
        startBtn().addEventListener('click', startRecognition);
        stopBtn().addEventListener('click', stopRecognition);
    }

    async function startRecognition() {
        try {
            // Check if students exist
            const students = await API.getStudents();
            if (students.length === 0) {
                App.toast('No students registered! Register students first.', 'warning');
                return;
            }

            stream = await Camera.start(video());
            placeholder().classList.add('hidden');

            isRunning = true;
            startBtn().style.display = 'none';
            stopBtn().style.display = 'inline-flex';

            // Load today's attendance
            const todayRecords = await API.getTodayAttendance();
            recognizedToday = new Set(todayRecords.map(r => r.student_id));
            updateRecognizedList(todayRecords);

            // Start sending frames to backend every 1.5 seconds
            recognitionInterval = setInterval(recognizeFrame, 1500);

            App.toast('Face recognition started! (Python backend processing)', 'success');
        } catch (error) {
            App.toast(error.message, 'error');
        }
    }

    async function recognizeFrame() {
        if (!isRunning) return;

        const v = video();
        if (!v.srcObject) return;

        // Capture a smaller frame for faster processing
        const frame = Camera.captureSmallFrame(v);

        try {
            const result = await API.recognizeFaces(frame);

            // Scale boxes from small frame (320x240) to actual video size
            if (result.faces) {
                result.faces.forEach(face => {
                    face.box.left = (face.box.left / 320) * v.videoWidth;
                    face.box.right = (face.box.right / 320) * v.videoWidth;
                    face.box.top = (face.box.top / 240) * v.videoHeight;
                    face.box.bottom = (face.box.bottom / 240) * v.videoHeight;
                });
            }

            // Draw detections
            Camera.drawDetections(overlay(), v, result.faces || []);

            // Mark attendance for recognized faces
            for (const face of (result.faces || [])) {
                if (face.matched && face.studentId && !recognizedToday.has(face.studentId)) {
                    try {
                        const markResult = await API.markAttendance(face.studentId);
                        if (!markResult.alreadyMarked) {
                            recognizedToday.add(face.studentId);
                            App.toast(`✅ ${face.name} marked present!`, 'success');

                            // Refresh the recognized list
                            const todayRecords = await API.getTodayAttendance();
                            updateRecognizedList(todayRecords);
                            Dashboard.refresh();
                        } else {
                            recognizedToday.add(face.studentId);
                        }
                    } catch (err) {
                        console.error('Mark attendance error:', err);
                    }
                }
            }
        } catch (error) {
            console.error('Recognition error:', error);
        }
    }

    function stopRecognition() {
        isRunning = false;

        if (recognitionInterval) {
            clearInterval(recognitionInterval);
            recognitionInterval = null;
        }

        Camera.stop(video());
        stream = null;

        const o = overlay();
        const ctx = o.getContext('2d');
        ctx.clearRect(0, 0, o.width, o.height);

        placeholder().classList.remove('hidden');
        startBtn().style.display = 'inline-flex';
        stopBtn().style.display = 'none';

        App.toast('Face recognition stopped.', 'info');
    }

    function updateRecognizedList(records) {
        if (!records || records.length === 0) {
            listEl().innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-face-smile-wink"></i>
                    <p>Start recognition to mark attendance</p>
                </div>
            `;
            return;
        }

        listEl().innerHTML = records.map(record => {
            const name = record.student_name;
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
            return `
                <div class="recognized-item">
                    <div class="avatar">${initials}</div>
                    <div class="info">
                        <strong>${name}</strong>
                        <span>${record.roll_number} • ${record.time}</span>
                    </div>
                    <i class="fas fa-circle-check check-icon"></i>
                </div>
            `;
        }).join('');
    }

    function cleanup() {
        if (isRunning) stopRecognition();
    }

    return { init, cleanup };
})();
