/**
 * SillyTavern 制卡工具 v4.0
 * 入口: 魔法棒菜单(卡片图标) + 扩展设置面板
 * 特性: 不覆盖酒馆、可自由调节大小、关闭后后台继续
 */

// ===== 常量 =====
const extensionName = 'st-card-maker';
// ST 把第三方扩展 clone 到 scripts/extensions/third-party/<repo-name>/
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let cmWindow = null;
let cmVisible = false;

const cardIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;

// ===== 打开窗口 =====
function openCardMaker() {
  if (cmWindow && document.body.contains(cmWindow)) {
    cmWindow.style.display = 'flex';
    cmVisible = true;
    return;
  }
  cmWindow = document.createElement('div');
  cmWindow.id = 'cm-window';
  cmWindow.innerHTML = `
    <div class="cm-container" id="cm-container">
      <div class="cm-header" id="cm-header">
        <span class="cm-header-title">${cardIcon.replace('16','18').replace('16','18')} 制卡工具</span>
        <div class="cm-header-actions">
          <button class="cm-hdr-btn" id="cm-fullscreen-btn" title="全屏/还原">⛶</button>
          <button class="cm-hdr-btn" id="cm-minimize-btn" title="最小化">─</button>
          <button class="cm-hdr-btn cm-close-btn" id="cm-close-btn" title="隐藏（后台继续）">✕</button>
        </div>
      </div>
      <iframe id="cm-iframe" src="/${extensionFolderPath}/tool.html" allow="clipboard-read; clipboard-write"></iframe>
      <div class="cm-resize cm-r-n" data-d="n"></div>
      <div class="cm-resize cm-r-s" data-d="s"></div>
      <div class="cm-resize cm-r-e" data-d="e"></div>
      <div class="cm-resize cm-r-w" data-d="w"></div>
      <div class="cm-resize cm-r-ne" data-d="ne"></div>
      <div class="cm-resize cm-r-nw" data-d="nw"></div>
      <div class="cm-resize cm-r-se" data-d="se"></div>
      <div class="cm-resize cm-r-sw" data-d="sw"></div>
    </div>
  `;
  document.body.appendChild(cmWindow);
  cmVisible = true;

  // 关闭 = 隐藏
  document.getElementById('cm-close-btn').addEventListener('click', () => {
    cmWindow.style.display = 'none'; cmVisible = false;
  });
  // 最小化
  document.getElementById('cm-minimize-btn').addEventListener('click', () => {
    cmWindow.style.display = 'none'; cmVisible = false;
  });
  // 全屏
  let fs = false;
  document.getElementById('cm-fullscreen-btn').addEventListener('click', () => {
    fs = !fs;
    document.getElementById('cm-container').classList.toggle('cm-fullscreen', fs);
  });

  initDrag();
  initResize();

  const iframe = document.getElementById('cm-iframe');
  iframe.addEventListener('load', () => passCtx(iframe));
}

// ===== 拖拽 =====
function initDrag() {
  const h = document.getElementById('cm-header');
  const c = document.getElementById('cm-container');
  let dragging = false, sx, sy, sl, st;

  function start(cx, cy) {
    dragging = true;
    const r = c.getBoundingClientRect();
    sx = cx; sy = cy; sl = r.left; st = r.top;
    c.style.transition = 'none';
    document.body.style.userSelect = 'none';
    const f = document.getElementById('cm-iframe');
    if (f) f.style.pointerEvents = 'none';
  }
  h.addEventListener('mousedown', e => { if (!e.target.closest('.cm-hdr-btn')) start(e.clientX, e.clientY); });
  h.addEventListener('touchstart', e => { if (!e.target.closest('.cm-hdr-btn')) start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  function move(cx, cy) {
    if (!dragging) return;
    c.style.position = 'fixed';
    c.style.left = (sl + cx - sx) + 'px';
    c.style.top = (st + cy - sy) + 'px';
    c.style.margin = '0'; c.style.transform = 'none';
  }
  document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  document.addEventListener('touchmove', e => { if (dragging) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  function end() {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    const f = document.getElementById('cm-iframe');
    if (f) f.style.pointerEvents = '';
  }
  document.addEventListener('mouseup', end);
  document.addEventListener('touchend', end);
}

// ===== 调整大小 =====
function initResize() {
  const c = document.getElementById('cm-container');
  let resizing = false, dir, sx, sy, sw, sh, sl, st;

  c.querySelectorAll('.cm-resize').forEach(handle => {
    function start(cx, cy) {
      resizing = true; dir = handle.dataset.d;
      sx = cx; sy = cy;
      const r = c.getBoundingClientRect();
      sw = r.width; sh = r.height; sl = r.left; st = r.top;
      c.style.transition = 'none';
      document.body.style.userSelect = 'none';
      const f = document.getElementById('cm-iframe');
      if (f) f.style.pointerEvents = 'none';
    }
    handle.addEventListener('mousedown', e => { e.preventDefault(); start(e.clientX, e.clientY); });
    handle.addEventListener('touchstart', e => { start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  });

  function move(cx, cy) {
    if (!resizing) return;
    const dx = cx - sx, dy = cy - sy;
    let nw = sw, nh = sh, nl = sl, nt = st;
    if (dir.includes('e')) nw = Math.max(300, sw + dx);
    if (dir.includes('w')) { nw = Math.max(300, sw - dx); nl = sl + dx; }
    if (dir.includes('s')) nh = Math.max(250, sh + dy);
    if (dir.includes('n')) { nh = Math.max(250, sh - dy); nt = st + dy; }
    Object.assign(c.style, {
      width: nw + 'px', height: nh + 'px',
      maxWidth: 'none', maxHeight: 'none',
      position: 'fixed', left: nl + 'px', top: nt + 'px',
      margin: '0', transform: 'none'
    });
  }
  document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  document.addEventListener('touchmove', e => { if (resizing) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  function end() {
    if (!resizing) return;
    resizing = false;
    document.body.style.userSelect = '';
    const f = document.getElementById('cm-iframe');
    if (f) f.style.pointerEvents = '';
  }
  document.addEventListener('mouseup', end);
  document.addEventListener('touchend', end);
}

// ===== 传递酒馆上下文给 iframe =====
function passCtx(iframe) {
  try {
    const ctx = SillyTavern.getContext();
    const data = {
      type: 'st-context',
      characterData: null,
      characters: [],
      worldBooks: [],
      userPersona: null,
      userDescription: ''
    };
    if (ctx.characterId !== undefined && ctx.characters) {
      data.characterData = ctx.characters[ctx.characterId] || null;
    }
    if (ctx.characters) {
      data.characters = ctx.characters.map(c => ({
        name: c.name,
        avatar: c.avatar,
        description: (c.data?.description || '').substring(0, 500)
      }));
    }
    if (ctx.name1) data.userPersona = { name: ctx.name1, description: ctx.name1Description || ctx.persona_description || '' };
    try { if (ctx.worldNames) data.worldBooks = ctx.worldNames.map(n => ({ name: n })); } catch(we) {}
    iframe.contentWindow.postMessage(data, '*');
  } catch (e) {
    console.warn('[CM] passCtx fail:', e);
  }
}

// ===== 监听 iframe 消息 =====
window.addEventListener('message', async (event) => {
  const msg = event.data;
  if (!msg || !msg.type || !msg.type.startsWith('cm-')) return;
  const iframe = document.getElementById('cm-iframe');

  try {
    if (msg.type === 'cm-get-context') {
      if (iframe) passCtx(iframe);
    }
    if (msg.type === 'cm-create-character' || msg.type === 'cm-overwrite-character') {
      try {
        const charData = msg.data;
        const avatarB64 = charData._avatarBase64;
        delete charData._avatarBase64;
        const charName = charData.data?.name || 'Character';

        // Try JSON API first (works on most ST versions)
        const jsonBody = {
          name: charName,
          description: charData.data?.description || '',
          personality: charData.data?.personality || '',
          first_mes: charData.data?.first_mes || '',
          mes_example: charData.data?.mes_example || '',
          scenario: charData.data?.scenario || '',
          creator_notes: charData.data?.creator_notes || '',
          system_prompt: charData.data?.system_prompt || '',
          post_history_instructions: charData.data?.post_history_instructions || '',
          tags: charData.data?.tags || [],
          creator: charData.data?.creator || '',
          character_version: charData.data?.character_version || '1.0',
          alternate_greetings: charData.data?.alternate_greetings || [],
          extensions: charData.data?.extensions || {},
          world: charData._worldName || ''
        };

        let res;
        if (msg.type === 'cm-overwrite-character') {
          // Overwrite needs avatar_url for existing char
          const ctx = SillyTavern.getContext();
          if (ctx.characterId !== undefined && ctx.characters) {
            const cur = ctx.characters[ctx.characterId];
            jsonBody.avatar_url = cur?.avatar || '';
          }
          res = await fetch('/api/characters/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonBody)
          });
        } else {
          res = await fetch('/api/characters/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonBody)
          });
        }

        if (res.ok) {
          const r = await res.json().catch(() => ({}));
          // If avatar provided, try to upload separately
          if (avatarB64) {
            try {
              const byteStr = atob(avatarB64);
              const arr = new Uint8Array(byteStr.length);
              for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
              const fd = new FormData();
              fd.append('avatar', new Blob([arr], { type: 'image/png' }), charName + '.png');
              fd.append('overwrite_name', charName);
              await fetch('/api/characters/edit', { method: 'POST', body: fd }).catch(() => {});
            } catch (ae) { console.warn('[CM] avatar upload:', ae); }
          }
          if (iframe) iframe.contentWindow.postMessage({ type: 'cm-create-result', success: true, data: r }, '*');
        } else {
          const errText = await res.text().catch(() => res.status);
          if (iframe) iframe.contentWindow.postMessage({ type: 'cm-create-result', success: false, error: 'HTTP ' + res.status + ': ' + errText }, '*');
        }
      } catch (e) {
        if (iframe) iframe.contentWindow.postMessage({ type: 'cm-create-result', success: false, error: e.message }, '*');
      }
    }
    if (msg.type === 'cm-fetch-models') {
      try {
        const hdrs = { 'Content-Type': 'application/json' };
        if (msg.apiKey) hdrs['Authorization'] = 'Bearer ' + msg.apiKey;
        const res = await fetch(msg.apiUrl.replace(/\/$/, '') + '/models', { headers: hdrs });
        const d = await res.json();
        const models = (d.data || d || []).map(m => m.id || m.name || m).filter(Boolean);
        if (iframe) iframe.contentWindow.postMessage({ type: 'cm-models-result', success: true, models }, '*');
      } catch (e) {
        if (iframe) iframe.contentWindow.postMessage({ type: 'cm-models-result', success: false, error: e.message }, '*');
      }
    }
    if (msg.type === 'cm-test-api') {
      try {
        const hdrs = { 'Content-Type': 'application/json' };
        if (msg.apiKey) hdrs['Authorization'] = 'Bearer ' + msg.apiKey;
        const res = await fetch(msg.apiUrl.replace(/\/$/, '') + '/models', { headers: hdrs });
        if (res.ok) {
          if (iframe) iframe.contentWindow.postMessage({ type: 'cm-test-result', success: true }, '*');
        } else {
          if (iframe) iframe.contentWindow.postMessage({ type: 'cm-test-result', success: false, error: 'HTTP ' + res.status }, '*');
        }
      } catch (e) {
        if (iframe) iframe.contentWindow.postMessage({ type: 'cm-test-result', success: false, error: e.message }, '*');
      }
    }
  } catch (e) {
    console.warn('[CM] msg err:', e);
  }
});

// ===== 初始化：注册菜单入口 =====
jQuery(async () => {
  try {
    // 1) 扩展设置面板
    jQuery('#extensions_settings2').append(`
      <div class="cm-ext-settings">
        <div class="inline-drawer">
          <div class="inline-drawer-toggle inline-drawer-header">
            <b>${cardIcon} 制卡工具</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
          </div>
          <div class="inline-drawer-content">
            <div style="padding:10px 0;">
              <p style="margin-bottom:8px;">AI 角色卡一键生成工具 v4.0</p>
              <div id="cm_launch_btn" class="menu_button menu_button_icon">
                ${cardIcon}
                <span>打开制卡工具</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
    jQuery('#cm_launch_btn').on('click', openCardMaker);

    // 2) 魔法棒菜单
    jQuery('#extensionsMenu').append(`
      <div id="cm_wand_btn" class="list-group-item flex-container flexGap5" title="制卡工具">
        ${cardIcon}
        制卡工具
      </div>
    `);
    jQuery('#cm_wand_btn').on('click', () => {
      openCardMaker();
      jQuery('#extensionsMenu').fadeOut(200);
    });

    console.log('[CM] 制卡工具 v4.0 loaded');
  } catch (e) {
    console.error('[CM] init error:', e);
  }
});
