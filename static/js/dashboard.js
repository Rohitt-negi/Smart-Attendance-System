/* =====================================================
   Dashboard Module - Stats & Charts
   ===================================================== */

const Dashboard = (() => {
    let attendanceChart = null;
    let weeklyChart = null;

    async function refresh() {
        try {
            const stats = await API.getStats();
            updateStats(stats);
            updateCharts(stats);
            updateActivity(stats.recent || []);
        } catch (error) {
            console.error('Dashboard refresh error:', error);
        }
    }

    function updateStats(stats) {
        animateNumber('totalStudents', stats.total);
        animateNumber('presentToday', stats.present);
        animateNumber('absentToday', stats.absent);
        document.getElementById('attendanceRate').textContent = stats.rate + '%';
    }

    function animateNumber(elementId, target) {
        const el = document.getElementById(elementId);
        const current = parseInt(el.textContent) || 0;
        if (current === target) return;

        const duration = 500;
        const start = performance.now();

        function update(timestamp) {
            const elapsed = timestamp - start;
            const progress = Math.min(elapsed / duration, 1);
            const easing = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(current + (target - current) * easing);
            if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    }

    function updateCharts(stats) {
        if (attendanceChart) attendanceChart.destroy();
        if (weeklyChart) weeklyChart.destroy();

        // Doughnut Chart
        const doughnutCtx = document.getElementById('attendanceChart').getContext('2d');
        attendanceChart = new Chart(doughnutCtx, {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Absent'],
                datasets: [{
                    data: [stats.present, stats.absent],
                    backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
                    borderColor: ['rgba(16, 185, 129, 1)', 'rgba(239, 68, 68, 1)'],
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 13 },
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });

        // Line Chart
        const lineCtx = document.getElementById('weeklyChart').getContext('2d');
        const gradient = lineCtx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        const weekly = stats.weekly || [];
        weeklyChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: weekly.map(d => d.label),
                datasets: [{
                    label: 'Students Present',
                    data: weekly.map(d => d.count),
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#64748b', font: { family: 'Inter' }, stepSize: 1 },
                        grid: { color: 'rgba(255,255,255,0.04)' }
                    },
                    x: {
                        ticks: { color: '#64748b', font: { family: 'Inter' } },
                        grid: { display: false }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateActivity(recent) {
        const container = document.getElementById('activityList');

        if (recent.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recent.map(record => {
            const initials = record.student_name.split(' ').map(n => n[0]).join('').toUpperCase();
            const timeAgo = getTimeAgo(new Date(record.timestamp));

            return `
                <div class="activity-item">
                    <div class="activity-avatar">${initials}</div>
                    <div class="activity-info">
                        <strong>${record.student_name}</strong>
                        <span>${record.roll_number} • ${record.department}</span>
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            `;
        }).join('');
    }

    function getTimeAgo(date) {
        const diff = Math.floor((new Date() - date) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    return { refresh };
})();
