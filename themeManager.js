/**
 * ThemeManager — Manages the 6 preset themes with visual selector cards
 */
const ThemeManager = (() => {
    const THEMES = [
        {
            id: 'classic',
            name: '经典靛蓝',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            className: 'theme-classic'
        },
        {
            id: 'midnight',
            name: '暗夜紫',
            gradient: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
            className: 'theme-midnight'
        },
        {
            id: 'sakura',
            name: '樱花粉',
            gradient: 'linear-gradient(135deg, #f472b6 0%, #fb923c 100%)',
            className: 'theme-sakura'
        },
        {
            id: 'emerald',
            name: '翡翠绿',
            gradient: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
            className: 'theme-emerald'
        },
        {
            id: 'amber',
            name: '琥珀金',
            gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            className: 'theme-amber'
        },
        {
            id: 'ocean',
            name: '深海蓝',
            gradient: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            className: 'theme-ocean'
        }
    ];

    let currentTheme = THEMES[0];
    let onChangeCallback = null;

    function init(gridEl, onChange) {
        onChangeCallback = onChange;
        renderGrid(gridEl);
        // Restore from localStorage
        const saved = localStorage.getItem('st-card-theme');
        const found = THEMES.find(t => t.id === saved);
        if (found) {
            currentTheme = found;
        }
        updateActiveCard(gridEl);
    }

    function renderGrid(gridEl) {
        gridEl.innerHTML = THEMES.map(theme => `
            <div class="theme-card" data-theme-id="${theme.id}" title="${theme.name}">
                <div class="theme-card-color" style="background: ${theme.gradient}">
                    <div class="check-mark"><i class="ri-check-line"></i></div>
                </div>
                <div class="theme-card-name">${theme.name}</div>
            </div>
        `).join('');

        gridEl.addEventListener('click', (e) => {
            const card = e.target.closest('.theme-card');
            if (!card) return;
            const themeId = card.dataset.themeId;
            const theme = THEMES.find(t => t.id === themeId);
            if (theme && theme.id !== currentTheme.id) {
                currentTheme = theme;
                localStorage.setItem('st-card-theme', theme.id);
                updateActiveCard(gridEl);
                if (onChangeCallback) onChangeCallback(theme);
            }
        });
    }

    function updateActiveCard(gridEl) {
        gridEl.querySelectorAll('.theme-card').forEach(card => {
            card.classList.toggle('active', card.dataset.themeId === currentTheme.id);
        });
    }

    function getCurrent() {
        return currentTheme;
    }

    function getAll() {
        return THEMES;
    }

    return { init, getCurrent, getAll };
})();
