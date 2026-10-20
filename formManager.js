/**
 * FormManager — Handles form state, accordion sections, tags, avatar, auto-save
 */
const FormManager = (() => {
    const STORAGE_KEY = 'st-card-data';
    let formData = {};
    let avatarDataUrl = null;
    let tags = [];
    let onChangeCallback = null;
    let autoSaveTimer = null;

    function init(onChange) {
        onChangeCallback = onChange;
        initAccordions();
        initTagInput();
        initAvatarUpload();
        initAutoGrow();
        initCharCounter();
        bindInputs();
        restore();
    }

    // --- Accordion ---
    function initAccordions() {
        document.querySelectorAll('.section-header[data-toggle]').forEach(header => {
            const section = header.closest('.editor-section');
            const content = section.querySelector('.section-content');

            // If content starts expanded, mark section open
            if (content.classList.contains('expanded')) {
                section.classList.add('open');
            }

            header.addEventListener('click', () => {
                const isOpen = section.classList.contains('open');
                if (isOpen) {
                    section.classList.remove('open');
                    content.classList.remove('expanded');
                } else {
                    section.classList.add('open');
                    content.classList.add('expanded');
                }
            });
        });
    }

    // --- Tag Input ---
    function initTagInput() {
        const wrapper = document.getElementById('tagInputWrapper');
        const input = document.getElementById('tagInput');

        if (!wrapper || !input) return;

        wrapper.addEventListener('click', () => input.focus());

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = input.value.trim().replace(/,$/, '');
                if (val && !tags.includes(val)) {
                    tags.push(val);
                    renderTags();
                    triggerChange();
                }
                input.value = '';
            } else if (e.key === 'Backspace' && !input.value && tags.length > 0) {
                tags.pop();
                renderTags();
                triggerChange();
            }
        });

        input.addEventListener('blur', () => {
            const val = input.value.trim().replace(/,$/, '');
            if (val && !tags.includes(val)) {
                tags.push(val);
                renderTags();
                triggerChange();
            }
            input.value = '';
        });
    }

    function renderTags() {
        const list = document.getElementById('tagList');
        if (!list) return;
        list.innerHTML = tags.map((tag, i) => `
            <span class="tag-item" data-index="${i}">
                ${escapeHtml(tag)}
                <button class="tag-remove" data-index="${i}" title="移除"><i class="ri-close-line"></i></button>
            </span>
        `).join('');

        list.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                tags.splice(idx, 1);
                renderTags();
                triggerChange();
            });
        });
    }

    // --- Avatar Upload ---
    function initAvatarUpload() {
        const preview = document.getElementById('avatarPreview');
        const input = document.getElementById('avatarInput');
        const removeBtn = document.getElementById('avatarRemoveBtn');

        if (!preview || !input || !removeBtn) return;

        preview.addEventListener('click', () => input.click());

        input.addEventListener('change', () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarDataUrl = e.target.result;
                showAvatarPreview();
                triggerChange();
            };
            reader.readAsDataURL(file);
        });

        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            avatarDataUrl = null;
            clearAvatarPreview();
            input.value = '';
            triggerChange();
        });
    }

    function showAvatarPreview() {
        const preview = document.getElementById('avatarPreview');
        const removeBtn = document.getElementById('avatarRemoveBtn');
        if (!preview) return;
        preview.innerHTML = `<img src="${avatarDataUrl}" alt="avatar">`;
        preview.classList.add('has-image');
        if (removeBtn) removeBtn.style.display = 'flex';
    }

    function clearAvatarPreview() {
        const preview = document.getElementById('avatarPreview');
        const removeBtn = document.getElementById('avatarRemoveBtn');
        if (!preview) return;
        preview.innerHTML = `
            <i class="ri-camera-line avatar-placeholder-icon"></i>
            <span class="avatar-placeholder-text">点击上传</span>
        `;
        preview.classList.remove('has-image');
        if (removeBtn) removeBtn.style.display = 'none';
    }

    // --- Auto-grow textareas ---
    function initAutoGrow() {
        document.querySelectorAll('.auto-grow').forEach(textarea => {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            });
        });
    }

    // --- Character counter for all textareas ---
    function initCharCounter() {
        document.querySelectorAll('.form-textarea').forEach(textarea => {
            let counter = textarea.parentElement.querySelector('.char-counter');
            if (!counter) {
                counter = document.createElement('div');
                counter.className = 'char-counter';
                counter.innerHTML = '<span class="count-val">0</span> 字';
                textarea.parentElement.appendChild(counter);
            }
            const span = counter.querySelector('.count-val') || counter.querySelector('span');
            textarea.addEventListener('input', () => {
                if (span) span.textContent = textarea.value.length;
            });
        });
    }

    function updateAllCounters() {
        document.querySelectorAll('.form-textarea').forEach(textarea => {
            const counter = textarea.parentElement.querySelector('.char-counter');
            if (counter) {
                const span = counter.querySelector('.count-val') || counter.querySelector('span');
                if (span) span.textContent = textarea.value.length;
            }
        });
    }

    // --- Bind all inputs ---
    function bindInputs() {
        document.querySelectorAll('[data-field]').forEach(el => {
            el.addEventListener('input', () => {
                formData[el.dataset.field] = el.value;
                debouncedChange();
            });
        });
    }

    function debouncedChange() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            save();
            triggerChange();
        }, 300);
    }

    function triggerChange() {
        if (onChangeCallback) onChangeCallback(getData());
    }

    // --- Get / Set Data ---
    function getData() {
        document.querySelectorAll('[data-field]').forEach(el => {
            formData[el.dataset.field] = el.value;
        });
        return {
            ...formData,
            tags: [...tags],
            avatar: avatarDataUrl
        };
    }

    function setData(data) {
        formData = {};
        document.querySelectorAll('[data-field]').forEach(el => {
            const field = el.dataset.field;
            const val = data[field] || '';
            el.value = val;
            formData[field] = val;
            if (el.classList.contains('auto-grow')) {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
            }
        });

        tags = Array.isArray(data.tags) ? [...data.tags] : [];
        renderTags();

        avatarDataUrl = data.avatar || null;
        if (avatarDataUrl) {
            showAvatarPreview();
        } else {
            clearAvatarPreview();
        }

        updateAllCounters();
        triggerChange();
    }

    function reset() {
        formData = {};
        tags = [];
        avatarDataUrl = null;
        document.querySelectorAll('[data-field]').forEach(el => {
            el.value = '';
            if (el.classList.contains('auto-grow')) {
                el.style.height = 'auto';
            }
        });
        renderTags();
        clearAvatarPreview();
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) avatarInput.value = '';
        updateAllCounters();
        localStorage.removeItem(STORAGE_KEY);
        triggerChange();
    }

    // --- Persistence ---
    function save() {
        try {
            const data = getData();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* Storage full or unavailable */ }
    }

    function restore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                setData(data);
            }
        } catch (e) { /* Corrupted data */ }
    }

    // --- Utilities ---
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init, getData, setData, reset, save };
})();
