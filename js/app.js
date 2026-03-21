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
        // Initialize database
        await DB.init();

        // Initialize modules
        Register.init();
        Attendance.init();
        Records.init();
        Students.init();

        // Setup navigation
        setupNavigation();
        setupMobileMenu();

        // Set current date
        updateDate();

        // Load face recognition models
        loadModels();

        // Initialize dashboard
        await Dashboard.init();
    }

    async function loadModels() {
        const statusEl = document.getElementById('modelStatus');
        const progressBar = document.getElementById('loaderProgress');
        const loadingScreen = document.getElementById('loadingScreen');

        try {
            await FaceRecognition.loadModels((progress) => {
                if (progressBar) {
                    progressBar.style.width = progress + '%';
                }
            });

            // Update status indicator
            statusEl.innerHTML = `
                <div class="status-dot ready"></div>
                <span>AI Models Ready</span>
            `;

            // Build labeled descriptors from existing students
            await FaceRecognition.buildLabeledDescriptors();

            // Hide loading screen
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 500);

            toast('AI models loaded successfully!', 'success');
        } catch (error) {
            statusEl.innerHTML = `
                <div class="status-dot error"></div>
                <span>Model Load Failed</span>
            `;

            // Still hide loading screen
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 500);

            toast('Failed to load AI models. Face recognition may not work.', 'error');
        }
    }

    function setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-links li');
        navLinks.forEach(li => {
            li.addEventListener('click', (e) => {
                e.preventDefault();
                const view = li.dataset.view;
                if (view) navigate(view);
            });
        });
    }

    function navigate(viewName) {
        if (viewName === currentView) return;

        // Call leave handler for current view
        const currentConfig = views[currentView];
        if (currentConfig && currentConfig.onLeave) {
            currentConfig.onLeave();
        }

        // Update nav active state
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.toggle('active', li.dataset.view === viewName);
        });

        // Switch view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(viewName + 'View');
        if (targetView) targetView.classList.add('active');

        // Update topbar
        const viewConfig = views[viewName];
        if (viewConfig) {
            document.getElementById('pageTitle').textContent = viewConfig.title;
            document.getElementById('pageSubtitle').textContent = viewConfig.subtitle;
        }

        currentView = viewName;

        // Call enter handler for new view
        if (viewConfig && viewConfig.onEnter) {
            viewConfig.onEnter();
        }

        // Close mobile menu
        document.getElementById('sidebar').classList.remove('open');
    }

    function setupMobileMenu() {
        const toggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');

        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar when clicking outside on mobile
        document.getElementById('mainContent').addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }

    function updateDate() {
        const dateEl = document.getElementById('currentDate');
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    // ---- Toast Notification System ----
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

        // Auto remove after 4 seconds
        setTimeout(() => {
            toastEl.classList.add('removing');
            setTimeout(() => toastEl.remove(), 300);
        }, 4000);
    }

    // Start when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

    return { navigate, toast };
})();
