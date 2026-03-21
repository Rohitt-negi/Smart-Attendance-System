/* =====================================================
   App Module - Main Application Controller
   ===================================================== */

const App = (() => {
    const views = {
        dashboard: {
            title: 'Dashboard',
            subtitle: 'Overview of attendance statistics',
            onEnter: () => Dashboard.refresh()
        },
        register: {
            title: 'Register Student',
            subtitle: 'Add new student with face recognition',
            onEnter: () => Register.setupFormListeners(),
            onLeave: () => Register.cleanup()
        },
        attendance: {
            title: 'Mark Attendance',
            subtitle: 'Live face recognition attendance marking',
            onLeave: () => Attendance.cleanup()
        },
        records: {
            title: 'Attendance Records',
            subtitle: 'View and export attendance history',
            onEnter: () => Records.loadRecords()
        },
        students: {
            title: 'Students',
            subtitle: 'Manage registered students',
            onEnter: () => Students.loadStudents()
        }
    };

    let currentView = 'dashboard';

    async function init() {
        // Initialize modules
        Register.init();
        Attendance.init();
        Records.init();
        Students.init();

        // Setup navigation
        setupNavigation();
        setupMobileMenu();
        updateDate();

        // Check backend connection
        await checkBackend();

        // Initialize dashboard
        await Dashboard.refresh();
    }

    async function checkBackend() {
        const statusEl = document.getElementById('modelStatus');
        const progressBar = document.getElementById('loaderProgress');
        const loadingScreen = document.getElementById('loadingScreen');

        progressBar.style.width = '30%';

        try {
            const ok = await API.checkBackend();
            progressBar.style.width = '100%';

            if (ok) {
                statusEl.innerHTML = `
                    <div class="status-dot ready"></div>
                    <span>Backend Connected</span>
                `;
                toast('Connected to Python backend!', 'success');
            }

            setTimeout(() => loadingScreen.classList.add('hidden'), 600);
        } catch (error) {
            progressBar.style.width = '100%';

            statusEl.innerHTML = `
                <div class="status-dot error"></div>
                <span>Backend Offline</span>
            `;

            setTimeout(() => loadingScreen.classList.add('hidden'), 600);
            toast('Cannot connect to Python backend. Start the server with: python app.py', 'error');
        }
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.addEventListener('click', (e) => {
                e.preventDefault();
                const view = li.dataset.view;
                if (view) navigate(view);
            });
        });
    }

    function navigate(viewName) {
        if (viewName === currentView) return;

        const currentConfig = views[currentView];
        if (currentConfig && currentConfig.onLeave) {
            currentConfig.onLeave();
        }

        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.toggle('active', li.dataset.view === viewName);
        });

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(viewName + 'View');
        if (targetView) targetView.classList.add('active');

        const viewConfig = views[viewName];
        if (viewConfig) {
            document.getElementById('pageTitle').textContent = viewConfig.title;
            document.getElementById('pageSubtitle').textContent = viewConfig.subtitle;
        }

        currentView = viewName;

        if (viewConfig && viewConfig.onEnter) {
            viewConfig.onEnter();
        }

        document.getElementById('sidebar').classList.remove('open');
    }

    function setupMobileMenu() {
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        document.getElementById('mainContent').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
    }

    function updateDate() {
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: 'fas fa-circle-check',
            error: 'fas fa-circle-xmark',
            warning: 'fas fa-triangle-exclamation',
            info: 'fas fa-circle-info'
        };

        const toastEl = document.createElement('div');
        toastEl.className = `toast ${type}`;
        toastEl.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toastEl);

        setTimeout(() => {
            toastEl.classList.add('removing');
            setTimeout(() => toastEl.remove(), 300);
        }, 4000);
    }

    document.addEventListener('DOMContentLoaded', init);

    return { navigate, toast };
})();
