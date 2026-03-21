/* =====================================================
   Attendance Module - Live Face Recognition
   ===================================================== */

const Attendance = (() => {
    let stream = null;
    let isRunning = false;
    let recognizedToday = new Set();
    let animFrameId = null;

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
        if (!FaceRecognition.isReady()) {
            App.toast('AI models still loading, please wait...', 'warning');
            return;
        }

        // Build/rebuild labeled descriptors
        await FaceRecognition.buildLabeledDescriptors();
        const matcher = FaceRecognition.getFaceMatcher();

        if (!matcher) {
            App.toast('No students registered yet! Register students first.', 'warning');
            return;
        }

        try {
            stream = await FaceRecognition.startCamera(video());
            placeholder().classList.add('hidden');

            const v = video();
            const o = overlay();
            o.width = v.videoWidth;
            o.height = v.videoHeight;

            isRunning = true;
            startBtn().style.display = 'none';
            stopBtn().style.display = 'inline-flex';

            // Load today's attendance to avoid duplicates
            const todayRecords = await DB.getTodayAttendance();
            recognizedToday = new Set(todayRecords.map(r => r.studentId));
            await updateRecognizedList();

            // Start recognition loop
            recognitionLoop(matcher);

            App.toast('Face recognition started!', 'success');
        } catch (error) {
            App.toast(error.message, 'error');
        }
    }

    async function recognitionLoop(matcher) {
        if (!isRunning) return;

        const v = video();
        const o = overlay();
        const displaySize = { width: o.clientWidth, height: o.clientHeight };
        faceapi.matchDimensions(o, displaySize);

        try {
            const detections = await FaceRecognition.detectAllFaces(v);

            if (detections && detections.length > 0) {
                const resized = faceapi.resizeResults(detections, displaySize);
                const labels = [];

                for (const detection of detections) {
                    const bestMatch = matcher.findBestMatch(detection.descriptor);
                    const studentId = parseInt(bestMatch.label);

                    if (bestMatch.label !== 'unknown' && !isNaN(studentId)) {
                        const student = await DB.getStudent(studentId);
                        if (student) {
                            labels.push(student.name);

                            // Mark attendance if not already done
                            if (!recognizedToday.has(studentId)) {
                                const alreadyMarked = await DB.isAlreadyMarked(studentId);
                                if (!alreadyMarked) {
                                    await DB.markAttendance(
                                        studentId,
                                        student.name,
                                        student.rollNumber,
                                        student.department
                                    );
                                    recognizedToday.add(studentId);
                                    await updateRecognizedList();
                                    Dashboard.refresh();
                                    App.toast(`✅ ${student.name} marked present!`, 'success');
                                } else {
                                    recognizedToday.add(studentId);
                                }
                            }
                        } else {
                            labels.push('unknown');
                        }
                    } else {
                        labels.push('unknown');
                    }
                }

                FaceRecognition.drawDetections(o, resized, displaySize, labels);
            } else {
                const ctx = o.getContext('2d');
                ctx.clearRect(0, 0, o.width, o.height);
            }
        } catch (err) {
            console.error('Recognition loop error:', err);
        }

        if (isRunning) {
            animFrameId = requestAnimationFrame(() => recognitionLoop(matcher));
        }
    }

    function stopRecognition() {
        isRunning = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        FaceRecognition.stopCamera(video());
        stream = null;

        const o = overlay();
        const ctx = o.getContext('2d');
        ctx.clearRect(0, 0, o.width, o.height);

        placeholder().classList.remove('hidden');
        startBtn().style.display = 'inline-flex';
        stopBtn().style.display = 'none';

        App.toast('Face recognition stopped.', 'info');
    }

    async function updateRecognizedList() {
        const todayRecords = await DB.getTodayAttendance();

        if (todayRecords.length === 0) {
            listEl().innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-face-smile-wink"></i>
                    <p>Start recognition to mark attendance</p>
                </div>
            `;
            return;
        }

        const sorted = todayRecords.sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        listEl().innerHTML = sorted.map(record => {
            const initials = record.studentName.split(' ').map(n => n[0]).join('').toUpperCase();
            return `
                <div class="recognized-item">
                    <div class="avatar">${initials}</div>
                    <div class="info">
                        <strong>${record.studentName}</strong>
                        <span>${record.rollNumber} • ${record.time}</span>
                    </div>
                    <i class="fas fa-circle-check check-icon"></i>
                </div>
            `;
        }).join('');
    }

    function cleanup() {
        if (isRunning) {
            stopRecognition();
        }
    }

    return { init, cleanup, updateRecognizedList };
})();
