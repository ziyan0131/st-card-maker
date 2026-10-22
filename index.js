/**
 * SillyTavern 制卡工具 v4.1
 * 入口: 魔法棒菜单(卡片图标) + 扩展设置面板
 * 修复: 手机全屏、CSRF、User人设、世界书参考、润色功能、上传功能
 */

// 获取请求头（含CSRF token）
function getReqHeaders() {
  try {
    // SillyTavern >= 1.10 提供 getRequestHeaders
    const ctx = SillyTavern.getContext();
    if (typeof ctx.getRequestHeaders === 'function') return ctx.getRequestHeaders();
  } catch {}
  // 从cookie或meta尝试获取CSRF token
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content ||
    document.cookie.split(';').find(c => c.trim().startsWith('csrf='))?.split('=')[1] || '';
  const h = { 'Content-Type': 'application/json' };
  if (csrf) h['X-CSRF-Token'] = csrf;
  return h;
}

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
      userPersonaFull: null,
    };
    // 稳健提取角色完整数据（兼容 json_data 字符串 / data 嵌套 / 平铺三种结构）
    function extractCharData(c) {
      if (!c) return null;
      let d = {};
      if (c.json_data) {
        if (typeof c.json_data === 'string') { try { const p = JSON.parse(c.json_data); d = p.data || p; } catch {} }
        else if (typeof c.json_data === 'object') { d = c.json_data.data || c.json_data; }
      }
      if (!d || Object.keys(d).length === 0) d = c.data || c;
      return {
        name: c.name || d.name,
        avatar: c.avatar || d.avatar,
        description: d.description || c.description || '',
        personality: d.personality || c.personality || '',
        scenario: d.scenario || c.scenario || '',
        first_mes: d.first_mes || c.first_mes || '',
        mes_example: d.mes_example || c.mes_example || '',
        system_prompt: d.system_prompt || c.system_prompt || '',
        creator_notes: d.creator_notes || c.creator_notes || '',
        creator: d.creator || c.creator || '',
        tags: d.tags || c.tags || [],
        character_book: d.character_book || c.character_book || null,
        extensions: d.extensions || c.extensions || {},
        characterRegex: (d.extensions || c.extensions || {}).regex_scripts || null
      };
    }
    // Full current character — try json_data first (keke method), then .data, then top-level
    if (ctx.characterId !== undefined && ctx.characters) {
      const c = ctx.characters[ctx.characterId];
      if (c) data.characterData = extractCharData(c);
    }
    // All characters list
    if (ctx.characters) {
      data.characters = ctx.characters.map(c => ({
        name: c.name, avatar: c.avatar,
        description: ((c.data?.description) || c.description || '').substring(0, 100)
      }));
    }
    // User persona — 兼容不同版本ST (Bug1修复)
    // getContext() 不再暴露 persona/persona_description 字段，改用 name1 + substituteParams/powerUserSettings
    const _personaName = ctx.name1 || ctx.userName || '';
    let _personaDesc = '';
    let _personaAvatar = '';
    try {
      // 1) 用宏替换获取当前人设描述（{{persona}} -> 当前人设描述）
      if (!_personaDesc && typeof ctx.substituteParams === 'function') {
        const pd = ctx.substituteParams('{{persona}}');
        if (pd && pd !== '{{persona}}') _personaDesc = pd;
      }
    } catch {}
    try {
      // 2) 从 powerUserSettings.persona_descriptions 读取（按当前用户名匹配）
      const pu = ctx.powerUserSettings;
      if (pu && pu.persona_descriptions) {
        const pd = pu.persona_descriptions;
        const names = pu.personas || {};
        const keys = Object.keys(pd);
        for (const k of keys) {
          if (names[k] === _personaName) { _personaDesc = pd[k]?.description || _personaDesc; _personaAvatar = _personaAvatar || k; break; }
        }
        if (!_personaDesc && pu.default_persona && pd[pu.default_persona]) {
          _personaDesc = pd[pu.default_persona]?.description || _personaDesc;
          _personaAvatar = _personaAvatar || pu.default_persona;
        }
      }
    } catch {}
    // 3) 旧版兜底
    if (!_personaDesc) _personaDesc = ctx.persona_description || ctx.name1Description || ctx.userDescription || '';
    if (!_personaAvatar) _personaAvatar = ctx.user_avatar || '';
    if (_personaName) {
      data.userPersona = { name: _personaName };
      data.userPersonaFull = { name: _personaName, description: _personaDesc, avatar: _personaAvatar };
    }
    // 全部 User 人设列表（用于自由选择参考人设，Bug1扩展）
    try {
      const pu = ctx.powerUserSettings || {};
      const personas = pu.personas || {};
      const descs = pu.persona_descriptions || {};
      const defPersona = pu.default_persona || '';
      const list = Object.keys(personas).map(av => ({
        avatar: av,
        name: personas[av] || av,
        description: (descs[av] && (descs[av].description || descs[av].title)) || '',
      }));
      if (list.length) data.userPersonas = list;
      data.userPersonaDefault = defPersona;
    } catch {}
    // World books list (names for selection) — getContext 提供 getWorldInfoNames()
    try {
      let wn = null;
      if (typeof ctx.getWorldInfoNames === 'function') wn = ctx.getWorldInfoNames();
      if (!wn || !wn.length) wn = ctx.worldNames || ctx.world_names;
      if (Array.isArray(wn)) data.worldBooks = wn.map(n => (typeof n === 'string' ? { name: n } : n));
    } catch {}
    iframe.contentWindow.postMessage(data, '*');
  } catch (e) {
    console.warn('[CM] passCtx fail:', e);
  }
}

// ===== 刷新角色列表并选中指定角色 =====
async function refreshAndSelect(avatar) {
  try {
    const ctx = SillyTavern.getContext();
    // 刷新角色列表
    if (typeof ctx.getCharacters === 'function') await ctx.getCharacters();
    // 再次取最新上下文，按 avatar 找到索引并选中
    const ctx2 = SillyTavern.getContext();
    const chars = ctx2.characters || [];
    let idx = -1;
    if (avatar) idx = chars.findIndex(c => c.avatar === avatar);
    if (idx < 0 && avatar) idx = chars.findIndex(c => (c.avatar || '').replace(/\.png$/i, '') === avatar.replace(/\.png$/i, ''));
    if (idx >= 0 && typeof ctx2.selectCharacterById === 'function') {
      await ctx2.selectCharacterById(idx);
    }
  } catch (e) {
    console.warn('[CM] refreshAndSelect fail:', e);
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
    // Fetch full character data via API (like keke)
    if (msg.type === 'cm-get-full-character') {
      try {
        const res = await fetch('/api/characters/get', {
          method: 'POST',
          headers: getReqHeaders(),
          body: JSON.stringify({ avatar_url: msg.avatar })
        });
        if (res.ok) {
          const data = await res.json();
          iframe.contentWindow.postMessage({ type: 'cm-full-character', success: true, data }, '*');
        } else {
          iframe.contentWindow.postMessage({ type: 'cm-full-character', success: false, error: 'HTTP ' + res.status }, '*');
        }
      } catch(e) {
        iframe.contentWindow.postMessage({ type: 'cm-full-character', success: false, error: e.message }, '*');
      }
    }
    // Fetch full character data via API (backup method)
    if (msg.type === 'cm-fetch-character') {
      try {
        const res = await fetch('/api/characters/get', {
          method: 'POST',
          headers: getReqHeaders(),
          body: JSON.stringify({ avatar_url: msg.avatar })
        });
        if (res.ok) {
          const data = await res.json();
          // Parse json_data if present
          let fullData = data;
          if (data.json_data && typeof data.json_data === 'string') {
            try { const p = JSON.parse(data.json_data); fullData = { ...data, _parsed: p.data || p }; } catch {}
          }
          iframe.contentWindow.postMessage({ type: 'cm-character-detail', success: true, data: fullData }, '*');
        } else {
          iframe.contentWindow.postMessage({ type: 'cm-character-detail', success: false }, '*');
        }
      } catch (e) {
        iframe.contentWindow.postMessage({ type: 'cm-character-detail', success: false, error: e.message }, '*');
      }
    }
    if (msg.type === 'cm-create-character' || msg.type === 'cm-overwrite-character') {
      try {
        const charData = msg.data;
        const avatarB64 = charData._avatarBase64 || (charData.data?.extensions?.avatar_base64);
        delete charData._avatarBase64;
        if (charData.data?.extensions?.avatar_base64) delete charData.data.extensions.avatar_base64;
        if (charData.data?.extensions?.avatar_mime) delete charData.data.extensions.avatar_mime;
        // Support both nested .data format and flat format
        const d = charData.data || charData;
        const charName = (d.name || charData.name || 'Character');

        // Build body in format SillyTavern expects
        const jsonBody = {
          ch_name: charName,  // SillyTavern uses ch_name
          name: charName,
          description: d.description || '',
          personality: d.personality || '',
          first_mes: d.first_mes || '',
          mes_example: d.mes_example || '',
          scenario: d.scenario || '',
          creator_notes: d.creator_notes || '',
          system_prompt: d.system_prompt || '',
          post_history_instructions: d.post_history_instructions || '',
          tags: d.tags || [],
          creator: d.creator || '',
          character_version: d.character_version || '1.0',
          alternate_greetings: d.alternate_greetings || [],
          extensions: d.extensions || {},
          world: charData._worldName || ''
        };
        if (d.character_book) jsonBody.character_book = d.character_book;

        // 使用 import API 创建角色（最可靠的方式）
        const v2Card = { spec:'chara_card_v2', spec_version:'2.0', data: jsonBody };
        const cardJson = JSON.stringify(v2Card);
        const importHdrs = getReqHeaders(); 
        delete importHdrs['Content-Type'];
        
        if (msg.type === 'cm-overwrite-character') {
          // 覆盖模式：用edit API
          const ctx = SillyTavern.getContext();
          let curAvatar = '';
          if (ctx.characterId !== undefined && ctx.characters) {
            const cur = ctx.characters[ctx.characterId];
            curAvatar = cur?.avatar || '';
          }
          jsonBody.avatar_url = curAvatar;
          const editRes = await fetch('/api/characters/edit', {
            method: 'POST', headers: getReqHeaders(), body: JSON.stringify(jsonBody)
          });
          if (!editRes.ok) throw new Error('Edit failed: ' + editRes.status);
          if (avatarB64 && curAvatar) {
            try {
              const raw = avatarB64.includes(',') ? avatarB64.split(',')[1] : avatarB64;
              const arr = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
              const avFd = new FormData();
              avFd.append('avatar', new Blob([arr], {type:'image/png'}), charName+'.png');
              avFd.append('avatar_url', curAvatar);
              await fetch('/api/characters/edit-avatar', {method:'POST', headers:importHdrs, body:avFd}).catch(()=>{});
            } catch {}
          }
          await refreshAndSelect(curAvatar);
          if (iframe) iframe.contentWindow.postMessage({ type: 'cm-create-result', success: true }, '*');
        } else {
          // 创建模式：JSON import + 单独上传头像
          const jsonBlob = new Blob([cardJson], {type:'application/json'});
          const fd = new FormData();
          fd.append('avatar', jsonBlob, (charName||'char')+'.json');
          fd.append('file_type', 'json');
          const createRes = await fetch('/api/characters/import', {method:'POST', headers:importHdrs, body:fd});
          if (!createRes.ok) throw new Error('Import failed: ' + createRes.status);
          const result = await createRes.json().catch(()=>({}));
          const newFileName = result.file_name || charName;
          // 上传头像（avatar_url 需带 .png 后缀）
          if (avatarB64 && newFileName) {
            try {
              const raw = avatarB64.includes(',') ? avatarB64.split(',')[1] : avatarB64;
              const arr = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
              const avFd = new FormData();
              avFd.append('avatar', new Blob([arr], {type:'image/png'}), charName+'.png');
              avFd.append('avatar_url', newFileName + '.png');
              await fetch('/api/characters/edit-avatar', {method:'POST', headers:importHdrs, body:avFd}).catch(()=>{});
            } catch {}
          }
          // 刷新角色列表并选中新角色（否则需重新上传才可见）
          await refreshAndSelect(newFileName + '.png');
          if (iframe) iframe.contentWindow.postMessage({ type: 'cm-create-result', success: true }, '*');
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
