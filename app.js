/**
 * App — Main application controller & Toast utility
 */

// --- Toast Notification System ---
const Toast = (() => {
    const icons = {
        success: 'ri-check-line',
        error: 'ri-error-warning-line',
        warning: 'ri-alert-line',
        info: 'ri-information-line'
    };

    function show(message, type, duration) {
        type = type || 'info';
        duration = duration || 3000;
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = '<i class="' + (icons[type] || icons.info) + '"></i><span>' + message + '</span>';
        container.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('toast-exit');
            setTimeout(function () { toast.remove(); }, 200);
        }, duration);
    }

    return { show: show };
})();

// --- Main App ---
(function App() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        // Init modules
        ThemeManager.init(
            document.getElementById('themeGrid'),
            onThemeChange
        );

        FormManager.init(onFormChange);

        CardRenderer.init(document.getElementById('cardContainer'));

        // Initial render
        CardRenderer.render(FormManager.getData());

        // Bind UI
        bindActions();
        bindModals();
        bindMobileToggle();
        bindDragDrop();
        bindCollapseAll();
        bindKeyboardShortcuts();
    });

    function onFormChange(data) {
        CardRenderer.render(data);
    }

    function onThemeChange() {
        CardRenderer.render(FormManager.getData());
    }

    // ---- Button bindings ----
    function bindActions() {
        document.getElementById('btnExportPNG').addEventListener('click', function () {
            ExportHandler.exportPNG(FormManager.getData());
        });

        document.getElementById('btnExportJSON').addEventListener('click', function () {
            ExportHandler.exportJSON(FormManager.getData());
        });

        document.getElementById('btnCopyImage').addEventListener('click', function () {
            ExportHandler.copyAsImage();
        });

        document.getElementById('btnImport').addEventListener('click', function () {
            document.getElementById('importModal').classList.add('active');
        });

        document.getElementById('btnReset').addEventListener('click', function () {
            document.getElementById('resetModal').classList.add('active');
        });

        document.getElementById('btnToggleEditor').addEventListener('click', function () {
            var editor = document.getElementById('editorPanel');
            editor.classList.toggle('hidden-mobile');
        });
    }

    // ---- Modal bindings ----
    function bindModals() {
        var importModal = document.getElementById('importModal');
        var importClose = document.getElementById('importModalClose');
        var importFileInput = document.getElementById('importFileInput');
        var dropZone = document.getElementById('dropZone');

        importClose.addEventListener('click', function () {
            importModal.classList.remove('active');
        });

        importModal.addEventListener('click', function (e) {
            if (e.target === importModal) importModal.classList.remove('active');
        });

        dropZone.addEventListener('click', function () {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', async function () {
            var file = importFileInput.files[0];
            if (file) {
                var data = await ExportHandler.importFile(file);
                if (data) FormManager.setData(data);
                importModal.classList.remove('active');
                importFileInput.value = '';
            }
        });

        var resetModal = document.getElementById('resetModal');
        document.getElementById('resetCancel').addEventListener('click', function () {
            resetModal.classList.remove('active');
        });

        document.getElementById('resetConfirm').addEventListener('click', function () {
            FormManager.reset();
            resetModal.classList.remove('active');
            Toast.show('已重置所有内容', 'success');
        });

        resetModal.addEventListener('click', function (e) {
            if (e.target === resetModal) resetModal.classList.remove('active');
        });
    }

    // ---- Mobile FAB toggle ----
    function bindMobileToggle() {
        var fab = document.getElementById('mobileFab');
        var editor = document.getElementById('editorPanel');
        var editorVisible = false;

        if (window.innerWidth <= 820) {
            editor.classList.add('hidden-mobile');
        }

        fab.addEventListener('click', function () {
            editorVisible = !editorVisible;
            if (editorVisible) {
                editor.classList.remove('hidden-mobile');
                fab.innerHTML = '<i class="ri-eye-line"></i>';
            } else {
                editor.classList.add('hidden-mobile');
                fab.innerHTML = '<i class="ri-edit-line"></i>';
            }
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 820) {
                editor.classList.remove('hidden-mobile');
            }
        });
    }

    // ---- Collapse All accordion toggle ----
    function bindCollapseAll() {
        var btn = document.getElementById('collapseAllBtn');
        if (!btn) return;
        var allCollapsed = false;

        btn.addEventListener('click', function () {
            allCollapsed = !allCollapsed;
            document.querySelectorAll('.editor-section').forEach(function (section) {
                var content = section.querySelector('.section-content');
                if (allCollapsed) {
                    section.classList.remove('open');
                    content.classList.remove('expanded');
                } else {
                    section.classList.add('open');
                    content.classList.add('expanded');
                }
            });
            btn.querySelector('span').textContent = allCollapsed ? '全部展开' : '全部折叠';
            btn.querySelector('i').className = allCollapsed ? 'ri-expand-up-down-line' : 'ri-contract-up-down-line';
        });
    }

    // ---- Keyboard shortcuts ----
    function bindKeyboardShortcuts() {
        document.addEventListener('keydown', function (e) {
            // Ctrl/Cmd + S → save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                FormManager.save();
                Toast.show('已保存', 'success', 1500);
            }
            // Ctrl/Cmd + E → export PNG
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                ExportHandler.exportPNG(FormManager.getData());
            }
            // Escape → close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(function (m) {
                    m.classList.remove('active');
                });
            }
        });
    }

    // ---- Drag & Drop import ----
    function bindDragDrop() {
        var dropZone = document.getElementById('dropZone');

        ['dragenter', 'dragover'].forEach(function (evtName) {
            dropZone.addEventListener(evtName, function (e) {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(function (evtName) {
            dropZone.addEventListener(evtName, function (e) {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', async function (e) {
            var file = e.dataTransfer.files[0];
            if (file) {
                var data = await ExportHandler.importFile(file);
                if (data) FormManager.setData(data);
                document.getElementById('importModal').classList.remove('active');
            }
        });

        // Page-level drag-drop
        document.body.addEventListener('dragover', function (e) { e.preventDefault(); });

        document.body.addEventListener('drop', async function (e) {
            e.preventDefault();
            var file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.json') || file.name.endsWith('.png'))) {
                var data = await ExportHandler.importFile(file);
                if (data) {
                    FormManager.setData(data);
                    Toast.show('文件已导入', 'success');
                }
            }
        });
    }
})();
