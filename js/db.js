/* =====================================================
   Database Layer - IndexedDB wrapper for persistence
   ===================================================== */

const DB = (() => {
    const DB_NAME = 'SmartAttendDB';
    const DB_VERSION = 1;
    let db = null;

    // Initialize the database
    function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // Students store
                if (!db.objectStoreNames.contains('students')) {
                    const studentsStore = db.createObjectStore('students', { keyPath: 'id', autoIncrement: true });
                    studentsStore.createIndex('rollNumber', 'rollNumber', { unique: true });
                    studentsStore.createIndex('name', 'name', { unique: false });
                }

                // Attendance store
                if (!db.objectStoreNames.contains('attendance')) {
                    const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
                    attendanceStore.createIndex('studentId', 'studentId', { unique: false });
                    attendanceStore.createIndex('date', 'date', { unique: false });
                    attendanceStore.createIndex('studentDate', ['studentId', 'date'], { unique: true });
                }
            };

            request.onsuccess = (e) => {
                db = e.target.result;
                resolve(db);
            };

            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    }

    // Generic transaction helper
    function getStore(storeName, mode = 'readonly') {
        const tx = db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    }

    function promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ---- Students CRUD ----

    async function addStudent(student) {
        const store = getStore('students', 'readwrite');
        student.createdAt = new Date().toISOString();
        return promisifyRequest(store.add(student));
    }

    async function getStudent(id) {
        const store = getStore('students');
        return promisifyRequest(store.get(id));
    }

    async function getAllStudents() {
        const store = getStore('students');
        return promisifyRequest(store.getAll());
    }

    async function deleteStudent(id) {
        const store = getStore('students', 'readwrite');
        return promisifyRequest(store.delete(id));
    }

    async function getStudentByRoll(rollNumber) {
        const store = getStore('students');
        const index = store.index('rollNumber');
        return promisifyRequest(index.get(rollNumber));
    }

    // ---- Attendance CRUD ----

    function getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    async function markAttendance(studentId, studentName, rollNumber, department) {
        const store = getStore('attendance', 'readwrite');
        const now = new Date();
        const record = {
            studentId,
            studentName,
            rollNumber,
            department,
            date: getTodayStr(),
            time: now.toLocaleTimeString(),
            timestamp: now.toISOString(),
            status: 'Present'
        };
        return promisifyRequest(store.add(record));
    }

    async function getAttendanceByDate(date) {
        const store = getStore('attendance');
        const index = store.index('date');
        return promisifyRequest(index.getAll(date));
    }

    async function getTodayAttendance() {
        return getAttendanceByDate(getTodayStr());
    }

    async function getAllAttendance() {
        const store = getStore('attendance');
        return promisifyRequest(store.getAll());
    }

    async function isAlreadyMarked(studentId, date) {
        const store = getStore('attendance');
        const index = store.index('studentDate');
        const result = await promisifyRequest(index.get([studentId, date || getTodayStr()]));
        return !!result;
    }

    async function deleteAttendanceForStudent(studentId) {
        const store = getStore('attendance', 'readwrite');
        const index = store.index('studentId');
        const records = await promisifyRequest(index.getAll(studentId));
        for (const record of records) {
            store.delete(record.id);
        }
    }

    // ---- Stats Helpers ----

    async function getDashboardStats() {
        const students = await getAllStudents();
        const todayAttendance = await getTodayAttendance();
        const total = students.length;
        const present = todayAttendance.length;
        const absent = total - present;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        return { total, present, absent, rate };
    }

    async function getWeeklyStats() {
        const days = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const attendance = await getAttendanceByDate(dateStr);
            days.push({
                date: dateStr,
                label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                count: attendance.length
            });
        }
        return days;
    }

    return {
        init,
        addStudent,
        getStudent,
        getAllStudents,
        deleteStudent,
        getStudentByRoll,
        markAttendance,
        getAttendanceByDate,
        getTodayAttendance,
        getAllAttendance,
        isAlreadyMarked,
        deleteAttendanceForStudent,
        getDashboardStats,
        getWeeklyStats,
        getTodayStr
    };
})();
