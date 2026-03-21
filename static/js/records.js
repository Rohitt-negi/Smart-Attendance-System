/* =====================================================
   Records Module - Attendance Records Table
   ===================================================== */

const Records = (() => {
    function init() {
        document.getElementById('recordDate').addEventListener('change', loadRecords);
        document.getElementById('recordSearch').addEventListener('input', loadRecords);
        document.getElementById('exportCSV').addEventListener('click', exportToCSV);

        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('recordDate').value = today;
    }

    async function loadRecords() {
        const dateFilter = document.getElementById('recordDate').value;
        const searchTerm = document.getElementById('recordSearch').value.trim();
        const tbody = document.getElementById('recordsBody');
        const emptyState = document.getElementById('recordsEmpty');
        const table = document.getElementById('recordsTable');

        try {
            const records = await API.getAttendance(dateFilter, searchTerm);

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
        } catch (error) {
            console.error('Load records error:', error);
            App.toast('Failed to load records.', 'error');
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
                let text = cell.textContent.trim().replace(/"/g, '""');
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

        App.toast('CSV exported successfully!', 'success');
    }

    return { init, loadRecords };
})();
