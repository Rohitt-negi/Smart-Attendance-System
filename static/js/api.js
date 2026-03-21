/* =====================================================
   API Layer - Communicates with Python Flask backend
   ===================================================== */

const API = (() => {
    const BASE = '';  // Same origin

    async function request(url, options = {}) {
        try {
            const response = await fetch(BASE + url, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error('Cannot connect to Python backend. Is the server running?');
            }
            throw error;
        }
    }

    // ── Students ──
    async function getStudents() {
        return request('/api/students');
    }

    async function registerStudent(name, rollNumber, department, photos) {
        return request('/api/students', {
            method: 'POST',
            body: JSON.stringify({ name, rollNumber, department, photos })
        });
    }

    async function deleteStudent(id) {
        return request(`/api/students/${id}`, { method: 'DELETE' });
    }

    // ── Face Recognition ──
    async function recognizeFaces(photoBase64) {
        return request('/api/recognize', {
            method: 'POST',
            body: JSON.stringify({ photo: photoBase64 })
        });
    }

    // ── Attendance ──
    async function markAttendance(studentId) {
        return request('/api/attendance', {
            method: 'POST',
            body: JSON.stringify({ studentId })
        });
    }

    async function getAttendance(dateFilter, search) {
        let url = '/api/attendance?';
        if (dateFilter) url += `date=${dateFilter}&`;
        if (search) url += `search=${encodeURIComponent(search)}`;
        return request(url);
    }

    async function getTodayAttendance() {
        return request('/api/attendance/today');
    }

    // ── Dashboard Stats ──
    async function getStats() {
        return request('/api/stats');
    }

    // ── Health Check ──
    async function checkBackend() {
        const response = await fetch(BASE + '/api/stats');
        return response.ok;
    }

    return {
        getStudents,
        registerStudent,
        deleteStudent,
        recognizeFaces,
        markAttendance,
        getAttendance,
        getTodayAttendance,
        getStats,
        checkBackend
    };
})();
