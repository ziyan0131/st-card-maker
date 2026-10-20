/**
 * SillyTavern 制卡工具扩展 v2.1
 * 入口：1) 左下角魔法棒弹出菜单  2) 扩展设置面板按钮
 */
import { extension_settings } from '../../../extensions.js';
import { getContext } from '../../../extensions.js';

const extensionName = 'third-party/st-card-maker';
const extensionFolderPath = `scripts/extensions/${extensionName}`;

let cardMakerWindow = null;

function openCardMaker() {
  if (cardMakerWindow && document.body.contains(cardMakerWindow)) {
    cardMakerWindow.style.display = 'flex';
    return;
  }

  cardMakerWindow = document.createElement('div');
  cardMakerWindow.id = 'card-maker-window';
  cardMakerWindow.innerHTML = `
    <div class="card-maker-overlay" id="card-maker-overlay">
      <div class="card-maker-container" id="card-maker-container">
        <div class="card-maker-header" id="card-maker-header">
          <span>🃏 制卡工具 v2.1</span>
          <div class="card-maker-header-actions">
            <button class="card-maker-header-btn" id="card-maker-fullscreen-btn" title="全屏/还原">⛶</button>
            <button class="card-maker-header-btn card-maker-close" id="card-maker-close-btn" title="关闭">✕</button>
          </div>
        </div>
        <iframe id="card-maker-iframe" src="/${extensionFolderPath}/tool.html" frameborder="0" allow="clipboard-read; clipboard-write"></iframe>
        <div class="card-maker-resize-handle card-maker-resize-n" data-dir="n"></div>
        <div class="card-maker-resize-handle card-maker-resize-s" data-dir="s"></div>
        <div class="card-maker-resize-handle card-maker-resize-e" data-dir="e"></div>
        <div class="card-maker-resize-handle card-maker-resize-w" data-dir="w"></div>
        <div class="card-maker-resize-handle card-maker-resize-ne" data-dir="ne"></div>
        <div class="card-maker-resize-handle card-maker-resize-nw" data-dir="nw"></div>
        <div class="card-maker-resize-handle card-maker-resize-se" data-dir="se"></div>
        <div class="card-maker-resize-handle card-maker-resize-sw" data-dir="sw"></div>
      </div>
    </div>
  `;

  document.body.appendChild(cardMakerWindow);

  document.getElementById('card-maker-close-btn').addEventListener('click', () => {
    cardMakerWindow.style.display = 'none';
  });
  document.getElementById('card-maker-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'card-maker-overlay') cardMakerWindow.style.display = 'none';
  });

  let isFullscreen = false;
  document.getElementById('card-maker-fullscreen-btn').addEventListener('click', () => {
    const container = document.getElementById('card-maker-container');
    isFullscreen = !isFullscreen;
    container.classList.toggle('card-maker-fullscreen', isFullscreen);
  });

  initDrag();
  initResize();

  const iframe = document.getElementById('card-maker-iframe');
  iframe.addEventListener('load', () => { passContextToIframe(iframe); });
}

function initDrag() {
  const header = document.getElementById('card-maker-header');
  const container = document.getElementById('card-maker-container');
  let isDragging = false, startX, startY, startLeft, startTop;

  const onStart = (cx, cy) => {
    isDragging = true;
    const rect = container.getBoundingClientRect();
    startX = cx; startY = cy; startLeft = rect.left; startTop = rect.top;
    container.style.transition = 'none';
    document.body.style.userSelect = 'none';
    const iframe = document.getElementById('card-maker-iframe');
    if (iframe) iframe.style.pointerEvents = 'none';
  };
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.card-maker-header-btn')) return;
    onStart(e.clientX, e.clientY);
  });
  header.addEventListener('touchstart', (e) => {
    if (e.target.closest('.card-maker-header-btn')) return;
    onStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  const onMove = (cx, cy) => {
    if (!isDragging) return;
    container.style.position = 'fixed';
    container.style.left = (startLeft + cx - startX) + 'px';
    container.style.top = (startTop + cy - startY) + 'px';
    container.style.margin = '0'; container.style.transform = 'none';
  };
  document.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  document.addEventListener('touchmove', (e) => { if (isDragging) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    const iframe = document.getElementById('card-maker-iframe');
    if (iframe) iframe.style.pointerEvents = '';
  };
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

function initResize() {
  const container = document.getElementById('card-maker-container');
  const handles = container.querySelectorAll('.card-maker-resize-handle');
  let isResizing = false, dir, startX, startY, startW, startH, startLeft, startTop;

  handles.forEach(handle => {
    const start = (cx, cy) => {
      isResizing = true; dir = handle.dataset.dir;
      startX = cx; startY = cy;
      const rect = container.getBoundingClientRect();
      startW = rect.width; startH = rect.height; startLeft = rect.left; startTop = rect.top;
      container.style.transition = 'none';
      document.body.style.userSelect = 'none';
      const iframe = document.getElementById('card-maker-iframe');
      if (iframe) iframe.style.pointerEvents = 'none';
    };
    handle.addEventListener('mousedown', (e) => { e.preventDefault(); start(e.clientX, e.clientY); });
    handle.addEventListener('touchstart', (e) => { start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  });

  const onMove = (cx, cy) => {
    if (!isResizing) return;
    const dx = cx - startX, dy = cy - startY;
    let newW = startW, newH = startH, newLeft = startLeft, newTop = startTop;
    if (dir.includes('e')) newW = Math.max(320, startW + dx);
    if (dir.includes('w')) { newW = Math.max(320, startW - dx); newLeft = startLeft + dx; }
    if (dir.includes('s')) newH = Math.max(300, startH + dy);
    if (dir.includes('n')) { newH = Math.max(300, startH - dy); newTop = startTop + dy; }
    Object.assign(container.style, {
      width: newW+'px', height: newH+'px', maxWidth:'none', maxHeight:'none',
      position:'fixed', left:newLeft+'px', top:newTop+'px', margin:'0', transform:'none'
    });
  };
  document.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  document.addEventListener('touchmove', (e) => { if (isResizing) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  const onEnd = () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.userSelect = '';
    const iframe = document.getElementById('card-maker-iframe');
    if (iframe) iframe.style.pointerEvents = '';
  };
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

function passContextToIframe(iframe) {
  try {
    const ctx = getContext();
    const data = { type:'st-context', characterData:null, worldBookData:null, characters:[] };
    if (ctx.characterId !== undefined && ctx.characters) {
      const char = ctx.characters[ctx.characterId];
      if (char) data.characterData = char;
    }
    if (ctx.characters) {
      data.characters = ctx.characters.map(c => ({ name:c.name, avatar:c.avatar, description:(c.data?.description||'').substring(0,200) }));
    }
    iframe.contentWindow.postMessage(data, '*');
  } catch (e) { console.warn('[Card Maker] context pass failed:', e); }
}

window.addEventListener('message', async (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;
  try {
    if (msg.type === 'st-get-context') {
      const iframe = document.getElementById('card-maker-iframe');
      if (iframe) passContextToIframe(iframe);
    }
    if (msg.type === 'st-create-character') {
      try {
        const response = await fetch('/api/characters/create', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(msg.data) });
        const result = await response.json();
        const iframe = document.getElementById('card-maker-iframe');
        if (iframe) iframe.contentWindow.postMessage({type:'st-create-result',success:true,data:result},'*');
      } catch(e) {
        const iframe = document.getElementById('card-maker-iframe');
        if (iframe) iframe.contentWindow.postMessage({type:'st-create-result',success:false,error:e.message},'*');
      }
    }
    if (msg.type === 'st-fetch-models') {
      try {
        const headers = {'Content-Type':'application/json'};
        if (msg.apiKey) headers['Authorization'] = 'Bearer ' + msg.apiKey;
        const res = await fetch(msg.apiUrl.replace(/\/$/, '') + '/models', {headers});
        const data = await res.json();
        const models = (data.data||data||[]).map(m=>m.id||m.name||m).filter(Boolean);
        const iframe = document.getElementById('card-maker-iframe');
        if (iframe) iframe.contentWindow.postMessage({type:'st-models-result',success:true,models},'*');
      } catch(e) {
        const iframe = document.getElementById('card-maker-iframe');
        if (iframe) iframe.contentWindow.postMessage({type:'st-models-result',success:false,error:e.message},'*');
      }
    }
  } catch(e) { console.warn('[Card Maker] msg error:', e); }
});

// ========== 导出 init 函数，由 hooks.activate 调用 ==========
export async function init() {
  try {
    // 1) 扩展设置面板
    const settingsHtml = `
      <div class="card-maker-settings">
        <div class="inline-drawer">
          <div class="inline-drawer-toggle inline-drawer-header">
            <b>制卡工具</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
          </div>
          <div class="inline-drawer-content">
            <div style="padding:10px 0;">
              <p>🃏 AI 角色卡一键生成工具</p>
              <p style="font-size:12px;opacity:0.7;margin:4px 0 8px;">支持角色卡、世界书、开场白、MVU状态栏</p>
              <div id="card_maker_launch_btn" class="menu_button menu_button_icon">
                <div class="fa-solid fa-wand-magic-sparkles"></div>
                <span>打开制卡工具</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    jQuery('#extensions_settings2').append(settingsHtml);
    jQuery('#card_maker_launch_btn').on('click', openCardMaker);

    // 2) 左下角魔法棒弹出菜单
    const menuItem = jQuery(`
      <div id="card_maker_wand_btn" class="list-group-item flex-container flexGap5" title="制卡工具">
        <div class="fa-solid fa-wand-magic-sparkles extensionsMenuExtensionButton"></div>
        制卡工具
      </div>
    `);
    jQuery('#extensionsMenu').append(menuItem);
    menuItem.on('click', () => {
      openCardMaker();
      jQuery('#extensionsMenu').fadeOut(200);
    });

    console.log('[Card Maker] 制卡工具扩展 v2.1 已加载');
  } catch (e) {
    console.error('[Card Maker] init error:', e);
  }
}
