/* =====================================================
   Records Module - Attendance Records Table
   ===================================================== */

const Records = (() => {
    function init() {
        document.getElementById('recordDate').addEventListener('change', loadRecords);
        document.getElementById('recordSearch').addEventListener('input', loadRecords);
        document.getElementById('exportCSV').addEventListener('click', exportToCSV);

        // Set default date to today
        document.getElementById('recordDate').value = DB.getTodayStr();
    }

    async function loadRecords() {
        const dateFilter = document.getElementById('recordDate').value;
        const searchTerm = document.getElementById('recordSearch').value.toLowerCase().trim();
        const tbody = document.getElementById('recordsBody');
        const emptyState = document.getElementById('recordsEmpty');
        const table = document.getElementById('recordsTable');

        let records = [];

        if (dateFilter) {
            // Get attendance for specific date
            const attended = await DB.getAttendanceByDate(dateFilter);
            const allStudents = await DB.getAllStudents();

            // Create records for all students (present + absent)
            for (const student of allStudents) {
                const attendRecord = attended.find(a => a.studentId === student.id);
                records.push({
                    rollNumber: student.rollNumber,
                    name: student.name,
                    department: student.department,
                    date: dateFilter,
                    time: attendRecord ? attendRecord.time : '-',
                    status: attendRecord ? 'Present' : 'Absent'
                });
            }
        } else {
            // Get all attendance records
            const allRecords = await DB.getAllAttendance();
            records = allRecords.map(r => ({
                rollNumber: r.rollNumber,
                name: r.studentName,
                department: r.department,
                date: r.date,
                time: r.time,
                status: r.status
            }));
        }

        // Apply search filter
        if (searchTerm) {
            records = records.filter(r =>
                r.name.toLowerCase().includes(searchTerm) ||
                r.rollNumber.toLowerCase().includes(searchTerm)
            );
        }

        // Sort by date descending, then name
        records.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return a.name.localeCompare(b.name);
        });

        if (records.length === 0) {
            table.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            table.style.display = 'table';
            emptyState.style.display = 'none';

            tbody.innerHTML = records.map(r => `
                <tr>
                    <td>${r.rollNumber}</td>
                    <td>${r.name}</td>
                    <td>${r.department}</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.time}</td>
                    <td><span class="status-badge ${r.status.toLowerCase()}">${r.status}</span></td>
                </tr>
            `).join('');
        }
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    function exportToCSV() {
        const table = document.getElementById('recordsTable');
        const rows = table.querySelectorAll('tr');

        if (rows.length <= 1) {
            App.toast('No records to export!', 'warning');
            return;
        }

        let csv = '';

        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            const rowData = Array.from(cells).map(cell => {
                let text = cell.textContent.trim();
                // Escape quotes
                text = text.replace(/"/g, '""');
                return `"${text}"`;
            });
            csv += rowData.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${document.getElementById('recordDate').value || 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        App.toast('CSV downloaded successfully!', 'success');
    }

    return { init, loadRecords };
})();
