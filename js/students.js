/* =====================================================
   Students Module - Student Management
   ===================================================== */

const Students = (() => {
    let deleteTargetId = null;

    function init() {
        document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
        document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
        document.getElementById('goToRegisterBtn').addEventListener('click', () => {
            App.navigate('register');
        });
    }

    async function loadStudents() {
        const students = await DB.getAllStudents();
        const grid = document.getElementById('studentsGrid');
        const empty = document.getElementById('studentsEmpty');

        if (students.length === 0) {
            grid.innerHTML = '';
            grid.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        empty.style.display = 'none';

        grid.innerHTML = students.map(student => {
            const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
            const photoHTML = student.photo
                ? `<img src="${student.photo}" alt="${student.name}">`
                : `<div class="placeholder-avatar">${initials}</div>`;

            return `
                <div class="student-card" data-id="${student.id}">
                    <div class="student-card-header">
                        <div class="student-avatar">
                            ${photoHTML}
                        </div>
                        <div class="info">
                            <h4>${student.name}</h4>
                            <p>${student.rollNumber}</p>
                        </div>
                    </div>
                    <div class="student-card-meta">
                        <div class="meta-tag">
                            <i class="fas fa-building-columns"></i>
                            ${student.department}
                        </div>
                        <div class="meta-tag">
                            <i class="fas fa-brain"></i>
                            ${student.faceDescriptors ? student.faceDescriptors.length : 0} face samples
                        </div>
                    </div>
                    <div class="student-card-actions">
                        <button class="btn btn-danger btn-sm" onclick="Students.requestDelete(${student.id}, '${student.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function requestDelete(studentId, studentName) {
        deleteTargetId = studentId;
        document.getElementById('deleteMessage').textContent =
            `Are you sure you want to remove "${studentName}"? This will also delete all their attendance records.`;
        document.getElementById('deleteModal').classList.add('active');
    }

    async function confirmDelete() {
        if (deleteTargetId === null) return;

        try {
            await DB.deleteAttendanceForStudent(deleteTargetId);
            await DB.deleteStudent(deleteTargetId);
            await FaceRecognition.buildLabeledDescriptors();

            App.toast('Student removed successfully.', 'success');
            closeDeleteModal();
            await loadStudents();
            Dashboard.refresh();
        } catch (error) {
            console.error('Delete error:', error);
            App.toast('Failed to delete student.', 'error');
        }
    }

    function closeDeleteModal() {
        deleteTargetId = null;
        document.getElementById('deleteModal').classList.remove('active');
    }

    return { init, loadStudents, requestDelete };
})();
