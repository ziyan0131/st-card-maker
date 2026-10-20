/**
 * CardRenderer — Renders the live preview card with theme-aware styling
 */
const CardRenderer = (() => {
    let containerEl = null;

    function init(container) {
        containerEl = container;
        render({});
    }

    function render(data) {
        if (!containerEl) return;

        const theme = ThemeManager.getCurrent();
        const name = data.name || '';
        const title = data.title || '';
        const version = data.version || '';
        const creator = data.creator || '';
        const tags = data.tags || [];
        const personality = data.personality || '';
        const description = data.description || '';
        const firstMes = data.first_mes || '';
        const mesExample = data.mes_example || '';
        const scenario = data.scenario || '';
        const systemPrompt = data.system_prompt || '';
        const postHistory = data.post_history_instructions || '';
        const creatorNotes = data.creator_notes || '';
        const avatar = data.avatar || null;

        const isEmpty = !name && !description && !firstMes && !personality;

        if (isEmpty) {
            containerEl.innerHTML = `
                <div class="st-card ${theme.className}">
                    <div class="st-card-header">
                        <div class="decor-circle"></div>
                        <div class="decor-circle"></div>
                        <div class="st-card-header-content">
                            <div class="st-card-header-info">
                                <div class="st-card-name" style="opacity:.5">角色名称</div>
                            </div>
                        </div>
                    </div>
                    <div class="st-card-empty">
                        <i class="ri-quill-pen-line"></i>
                        <p>在左侧填写角色信息<br>卡片将在这里实时预览</p>
                    </div>
                </div>
            `;
            return;
        }

        // Build avatar HTML
        let avatarHtml = '';
        if (avatar) {
            avatarHtml = `<div class="st-card-avatar"><img src="${avatar}" alt="avatar"></div>`;
        } else if (name) {
            const letter = name.charAt(0).toUpperCase();
            avatarHtml = `<div class="st-card-avatar"><span class="avatar-letter">${escapeHtml(letter)}</span></div>`;
        }

        // Build subtitle line
        let subtitleParts = [];
        if (title) subtitleParts.push(escapeHtml(title));
        if (version) subtitleParts.push(`v${escapeHtml(version)}`);
        let subtitleHtml = subtitleParts.join(' <span class="divider-dot"></span> ');

        // Build tags HTML
        let tagsHtml = '';
        if (tags.length > 0) {
            tagsHtml = `<div class="st-card-tags">
                ${tags.map(t => `<span class="st-card-tag">${escapeHtml(t)}</span>`).join('')}
            </div>`;
        }

        // Build sections
        let sectionsHtml = '';

        if (personality) {
            sectionsHtml += buildSection('ri-heart-pulse-line', '性格', personality);
        }

        if (description) {
            sectionsHtml += buildSection('ri-file-text-line', '描述', description);
        }

        if (scenario) {
            sectionsHtml += buildSection('ri-landscape-line', '场景', scenario);
        }

        if (firstMes) {
            sectionsHtml += `
                <div class="st-card-section">
                    <div class="st-card-section-label">
                        <i class="ri-chat-smile-2-line"></i> 开场白
                    </div>
                    <div class="st-card-first-message">${escapeHtml(firstMes)}</div>
                </div>
            `;
        }

        if (mesExample) {
            sectionsHtml += buildSection('ri-chat-history-line', '对话示例', mesExample);
        }

        if (systemPrompt) {
            sectionsHtml += buildSection('ri-terminal-box-line', '系统提示词', systemPrompt);
        }

        if (postHistory) {
            sectionsHtml += buildSection('ri-list-ordered-2', '后置指令', postHistory);
        }

        if (creatorNotes) {
            sectionsHtml += buildSection('ri-sticky-note-line', '创作备注', creatorNotes);
        }

        // Calculate stats
        const totalChars = (description + personality + firstMes + mesExample + scenario + systemPrompt + postHistory).length;
        const tokenEstimate = Math.ceil(totalChars / 2); // Rough CJK estimate

        // Build footer
        let footerLeftHtml = '';
        if (creator) {
            footerLeftHtml = `<i class="ri-user-line"></i> ${escapeHtml(creator)}`;
        } else {
            footerLeftHtml = `<i class="ri-magic-line"></i> SillyTavern`;
        }

        containerEl.innerHTML = `
            <div class="st-card ${theme.className}">
                <div class="st-card-header">
                    <div class="decor-circle"></div>
                    <div class="decor-circle"></div>
                    <div class="st-card-header-content">
                        ${avatarHtml}
                        <div class="st-card-header-info">
                            <div class="st-card-name">${escapeHtml(name)}</div>
                            ${subtitleHtml ? `<div class="st-card-title-line">${subtitleHtml}</div>` : ''}
                        </div>
                    </div>
                </div>
                ${tagsHtml}
                <div class="st-card-body">
                    ${sectionsHtml}
                </div>
                <div class="st-card-footer">
                    <div class="st-card-footer-left">${footerLeftHtml}</div>
                    <div class="st-card-footer-right">
                        <span class="st-card-stat"><i class="ri-file-text-line"></i> ${totalChars}字</span>
                        <span class="st-card-stat"><i class="ri-coin-line"></i> ~${tokenEstimate}tokens</span>
                    </div>
                </div>
            </div>
        `;
    }

    function buildSection(icon, label, text) {
        return `
            <div class="st-card-section">
                <div class="st-card-section-label">
                    <i class="${icon}"></i> ${label}
                </div>
                <div class="st-card-section-text">${escapeHtml(text)}</div>
            </div>
        `;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getCardElement() {
        if (!containerEl) return null;
        return containerEl.querySelector('.st-card');
    }

    return { init, render, getCardElement };
})();
