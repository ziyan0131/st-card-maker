
// ==================== 全局状态 ====================
const GD={charMods:{},wbEntries:[],openings:[],regexEntries:[]};
let isGen=false,abortCtrl=null,stCtx=null;
let charTags=[],charImg=null,charImgMime='image/png';
let importedCard=null; // single declaration
let refSel={user:false,curChar:false,worldBook:false};
let refFileContents=[];
let multiChars=[],dynEnabled=false;
let opIdx=0,opEditing=false;
let aiOpen=false,aiHist=[];
let mvuVars=[];

const CHAR_MODS=[
  {key:'personality',label:'性格',icon:'💭'},{key:'appearance',label:'外貌',icon:'👁'},{key:'background',label:'背景故事',icon:'📜'},
  {key:'love',label:'恋爱观',icon:'💕'},{key:'speech',label:'说话风格',icon:'🗣'},{key:'likes',label:'喜好与厌恶',icon:'❤️'},
  {key:'skills',label:'技能能力',icon:'⚔'},{key:'secrets',label:'秘密与阴暗面',icon:'🌑'},{key:'relationships',label:'人际关系',icon:'👥'},
  {key:'daily',label:'日常习惯',icon:'☕'},{key:'sexuality',label:'性相关设定',icon:'🔥'}
];
const WB_MODS=[
  {key:'world',label:'世界设定',icon:'🌐'},{key:'relations',label:'人物关系',icon:'🔗'},{key:'magic',label:'魔法体系',icon:'✨'},
  {key:'factions',label:'势力阵营',icon:'⚔'},{key:'places',label:'场所地点',icon:'🗺'},{key:'events',label:'重要事件',icon:'📅'},
  {key:'items',label:'道具物品',icon:'📦'},{key:'daily_world',label:'日常场景',icon:'☕'},{key:'rules',label:'世界规则',icon:'📋'},
  {key:'npcs',label:'NPC档案',icon:'🎭'},{key:'nsfw',label:'NSFW设定',icon:'🔥'}
];
let selCharMods=new Set(['personality','appearance','background','speech','love','likes']);
let selWbMods=new Set(['world','relations']);
let customCharMods=[],customWbMods=[];
const langMap={zh:'中文',en:'English',ja:'日本語'};

// ==================== 初始化 ====================
function init(){
  renderCharModTags();renderWbModTags();renderCharModsArea();renderWbModsArea();
  syncOpReqs();
  const t=localStorage.getItem('cm5_theme')||'rose';
  setTheme(t,document.querySelector(`.theme-sw[data-t="${t}"]`));
  const fs=localStorage.getItem('cm5_fs');if(fs){setFontSize(fs);document.getElementById('font-slider').value=fs;}
  loadConfig();
  // 尝试从服务器加载历史（跨设备互通）
  loadServerHistory().then(()=>renderHistory()).catch(()=>renderHistory());
  reqCtx();
  // 监听父页面消息
  window.addEventListener('message',onMsg);
  // AI面板拖拽
  initAIPanelDrag();
  // 开场白select监听
  document.getElementById('op-len').onchange=function(){
    document.getElementById('op-custom-len-row').style.display=this.value==='custom'?'block':'none';
  };
  document.getElementById('op-count').onchange=syncOpReqs;
}
window.addEventListener('DOMContentLoaded',init);

function reqCtx(){
  // 尝试直接调用ST API + postMessage双管齐下 + 延迟重试
  let loaded=false;
  try{
    const ctx=window.parent?.SillyTavern?.getContext?.();
    if(ctx&&ctx.characters&&ctx.characters.length>0){
      _loadFromSTContext(ctx);
      loaded=true;
    }
  }catch(e){console.warn('[CM] direct access failed:',e);}
  // 同时发postMessage（作为备份）
  window.parent.postMessage({type:'cm-get-context'},'*');
  // ST 初始化后主动刷新角色索引，避免首次打开时 context.characters 为空
  if(!loaded){
    setTimeout(async()=>{try{const c=window.parent?.SillyTavern?.getContext?.();if(c){if(typeof c.getCharacters==='function')await c.getCharacters();const c2=window.parent?.SillyTavern?.getContext?.();if(c2&&c2.characters?.length)_loadFromSTContext(c2);}}catch(err){console.warn('[CM] character refresh failed',err);}},1200);
  }
  // 如果没加载成功，延迟重试（等ST完全初始化）
  if(!loaded){
    setTimeout(()=>{
      try{
        const ctx2=window.parent?.SillyTavern?.getContext?.();
        if(ctx2&&ctx2.characters&&ctx2.characters.length>0&&!stCtx?.characters?.length){
          _loadFromSTContext(ctx2);
        }
      }catch{}
    },2000);
    setTimeout(()=>{
      try{
        const ctx3=window.parent?.SillyTavern?.getContext?.();
        if(ctx3&&ctx3.characters&&ctx3.characters.length>0&&!stCtx?.characters?.length){
          _loadFromSTContext(ctx3);
        }
      }catch{}
    },5000);
  }
}
function _loadFromSTContext(ctx){
  stCtx={type:'st-context'};
  // 角色列表
  if(ctx.characters){
    stCtx.characters=ctx.characters.map(c=>({name:c.name,avatar:c.avatar,description:((c.data?.description)||c.description||'').substring(0,100)}));
  }
  // 当前角色完整数据
  if(ctx.characterId!==undefined&&ctx.characters){
    const c=ctx.characters[ctx.characterId];
    if(c){
      let d={};
      if(c.json_data&&typeof c.json_data==='string'){try{const p=JSON.parse(c.json_data);d=p.data||p;}catch{}}
      if(!d.description)d=c.data||c;
      stCtx.characterData={name:c.name||d.name,avatar:c.avatar,description:d.description||c.description||'',personality:d.personality||c.personality||'',scenario:d.scenario||'',first_mes:d.first_mes||'',mes_example:d.mes_example||'',system_prompt:d.system_prompt||'',creator_notes:d.creator_notes||'',creator:d.creator||'',tags:d.tags||c.tags||[],character_book:d.character_book||c.character_book||null};
    }
  }
  // User人设
  const pName=ctx.name1||'';
  if(pName){
    let pDesc='',pAv='';
    try{if(ctx.personas&&ctx.persona_id&&ctx.personas[ctx.persona_id]){pDesc=ctx.personas[ctx.persona_id].description||'';pAv=ctx.personas[ctx.persona_id].avatar||'';}}catch{}
    if(!pDesc)pDesc=ctx.persona_description||'';
    if(!pAv)pAv=ctx.user_avatar||'';
    stCtx.userPersona={name:pName};
    stCtx.userPersonaFull={name:pName,description:pDesc,avatar:pAv};
  }
  // 世界书列表
  try{if(ctx.worldNames)stCtx.worldBooks=ctx.worldNames.map(n=>({name:n}));}catch{}
  // 渲染UI
  renderRefCards();
  // 填充角色选择列表
  const sel=document.getElementById('ref-char-select');
  if(sel&&stCtx.characters){
    sel.innerHTML='<option value="">-- 当前角色 --</option>';
    stCtx.characters.forEach(c=>{sel.innerHTML+=`<option value="${esc(c.avatar)}">${esc(c.name)}</option>`;});
  }
  toast('✅ 已获取酒馆数据','success');
}

function onMsg(e){
  const m=e.data;if(!m||!m.type)return;
  if(m.type==='st-context'){
    stCtx=m;
    renderRefCards();
    // 填充角色选择列表
    const sel=document.getElementById('ref-char-select');
    if(sel&&m.characters){
      sel.innerHTML='<option value="">-- 当前角色 --</option>';
      m.characters.forEach(c=>{
        sel.innerHTML+=`<option value="${esc(c.avatar)}">${esc(c.name)}</option>`;
      });
    }
  }
  if(m.type==='cm-full-character'){
    document.getElementById('ref-char-loading').style.display='none';
    if(m.success&&m.data){
      // Parse json_data for full content
      let d={};
      if(m.data.json_data&&typeof m.data.json_data==='string'){
        try{const p=JSON.parse(m.data.json_data);d=p.data||p;}catch{}
      }
      if(!d.description)d=m.data.data||m.data;
      // Update stCtx.characterData with full data
      stCtx.characterData={
        name:m.data.name||d.name,avatar:m.data.avatar,
        description:d.description||'',personality:d.personality||'',
        scenario:d.scenario||'',first_mes:d.first_mes||'',
        mes_example:d.mes_example||'',system_prompt:d.system_prompt||'',
        creator_notes:d.creator_notes||'',creator:d.creator||'',
        tags:d.tags||[],character_book:d.character_book||null
      };
      renderRefCards();
      toast('✅ 已加载: '+(d.name||m.data.name),'success');
    }else toast('❌ 加载失败: '+(m.error||''),'error');
  }
  if(m.type==='cm-create-result'){
    const el=document.getElementById('export-status');
    if(m.success){el.className='status success';el.textContent='✅ 已成功上传到酒馆！';}
    else{el.className='status error';el.textContent='❌ 上传失败: '+(m.error||'');}
    toast(m.success?'✅ 上传成功！':'❌ 上传失败: '+(m.error||''),m.success?'success':'error');
  }
}

// ==================== 参考资料卡片 ====================
function renderRefCards(){
  // User人设
  const uc=document.getElementById('ref-user-card');
  if(stCtx?.userPersonaFull){
    const up=stCtx.userPersonaFull;
    const av=up.avatar?`/User Avatars/${up.avatar}`:`/img/default-user-avatar.png`;
    const desc=up.description||'暂无描述';
    uc.innerHTML=`<div class="persona-card" style="cursor:pointer" onclick="const d=this.querySelector('.persona-full');d.style.display=d.style.display==='none'?'block':'none'">
      <img class="persona-av" src="${av}" onerror="this.src='/img/default-user-avatar.png'">
      <div class="persona-info">
        <div class="persona-name">👤 ${esc(up.name)} <span style="font-size:10px;color:var(--tx2)">▼ 点击展开</span></div>
        <div class="persona-desc">${esc(desc.substring(0,80))}${desc.length>80?'…':''}</div>
        <div class="persona-full" style="display:none;margin-top:6px;font-size:11px;white-space:pre-wrap;max-height:200px;overflow-y:auto;background:var(--sf);padding:8px;border-radius:6px;border:1px solid var(--bd)">${esc(desc)}</div>
      </div>
    </div>`;
  } else uc.innerHTML='<div style="font-size:11px;color:var(--tx2);padding:8px">未获取到User人设（请在酒馆中选择角色后点击「重新获取」）</div>';
  // 角色卡
  const cc=document.getElementById('ref-char-card');
  if(stCtx?.characterData){
    const cd=stCtx.characterData;
    const av=cd.avatar?`/characters/${cd.avatar}`:`/img/default-avatar.png`;
    const desc=cd.description||'暂无描述';
    cc.innerHTML=`<div class="persona-card" style="cursor:pointer" onclick="const d=this.querySelector('.persona-full');d.style.display=d.style.display==='none'?'block':'none'">
      <img class="persona-av" src="${av}" onerror="this.src='/img/default-avatar.png'">
      <div class="persona-info">
        <div class="persona-name">🎭 ${esc(cd.name)} <span style="font-size:10px;color:var(--tx2)">▼ 点击展开</span></div>
        <div class="persona-desc">${esc(desc.substring(0,80))}${desc.length>80?'…':''}</div>
        <div class="persona-full" style="display:none;margin-top:6px;font-size:11px;white-space:pre-wrap;max-height:200px;overflow-y:auto;background:var(--sf);padding:8px;border-radius:6px;border:1px solid var(--bd)">${esc(desc)}</div>
      </div>
    </div>`;
    // 世界书列表
    const wbl=document.getElementById('ref-wb-list');
    if(cd.character_book&&cd.character_book.entries){
      const entries=Array.isArray(cd.character_book.entries)?cd.character_book.entries:Object.values(cd.character_book.entries);
      wbl.innerHTML=entries.map((en,i)=>{
        const k=Array.isArray(en.keys)?en.keys.join(','):(en.keys||'');
        const chk=`<input type="checkbox" checked style="width:auto" id="wbsel-${i}">`;
        return `<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:var(--ibg);border:1px solid var(--bd);border-radius:6px;margin-bottom:3px;cursor:pointer;font-size:11px">${chk}<span style="flex:1">${esc(en.comment||en.name||'条目'+(i+1))}</span><span style="color:var(--tx2)">${(en.content||'').length}字</span></label>`;
      }).join('');
    } else wbl.innerHTML='<div style="font-size:11px;color:var(--tx2)">该角色卡暂无世界书</div>';
  } else cc.innerHTML='<div style="font-size:11px;color:var(--tx2);padding:8px">未获取到角色卡（请在酒馆选择角色后点击「重新获取」）</div>';
}

function loadSelectedChar(avatar){
  if(!avatar)return;
  document.getElementById('ref-char-loading').style.display='block';
  window.parent.postMessage({type:'cm-get-full-character',avatar},'*');
}
function buildRef(){
  let ctx='';
  if(refSel.curChar&&stCtx?.characterData){
    const d=stCtx.characterData;
    ctx+='\n【参考-当前角色卡】\n名称:'+d.name+'\n'+d.description;
    if(refSel.worldBook&&d.character_book&&d.character_book.entries){
      const entries=Array.isArray(d.character_book.entries)?d.character_book.entries:Object.values(d.character_book.entries);
      // 只包含用户勾选的条目
      const selected=[];
      document.querySelectorAll('[id^="wbsel-"]').forEach((el,i)=>{
        if(el.checked&&entries[i])selected.push(`[${entries[i].comment||entries[i].name}] ${entries[i].content}`);
      });
      if(selected.length) ctx+='\n【角色世界书（已选）】\n'+selected.join('\n').substring(0,3000);
    }
  }
  if(refSel.user&&stCtx?.userPersonaFull){
    const up=stCtx.userPersonaFull;
    ctx+='\n【参考-User人设】\n'+up.name+(up.description?'\n'+up.description:'');
  }
  const custom=document.getElementById('custom-ref').value.trim();
  if(custom)ctx+='\n【参考资料】\n'+custom;
  if(refFileContents.length)ctx+='\n【上传文件】\n'+refFileContents.map(f=>f.name+': '+f.text.substring(0,2000)).join('\n---\n');
  return ctx;
}

function handleRefFiles(e){
  Array.from(e.target.files).forEach(f=>{
    const r=new FileReader();
    r.onload=ev=>{refFileContents.push({name:f.name,text:ev.target.result.substring(0,5000)});renderRefFileList();};
    r.readAsText(f);
  });
}
function renderRefFileList(){
  const a=document.getElementById('ref-files-list');
  a.innerHTML=refFileContents.map((f,i)=>`<div style="display:flex;justify-content:space-between"><span>📄 ${f.name}</span><span style="cursor:pointer;color:var(--ac)" onclick="refFileContents.splice(${i},1);renderRefFileList()">✕</span></div>`).join('');
}

// ==================== 模块渲染 ====================
function renderCharModTags(){
  const c=document.getElementById('char-mod-tags');c.innerHTML='';
  [...CHAR_MODS,...customCharMods].forEach(m=>{
    const d=document.createElement('div');d.className='tag-item'+(selCharMods.has(m.key)?' selected':'');
    d.innerHTML=`<span>${m.icon} ${m.label}</span>${customCharMods.find(x=>x.key===m.key)?'<span style="margin-left:4px;cursor:pointer;font-size:9px" onclick="event.stopPropagation();customCharMods=customCharMods.filter(x=>x.key!==\''+m.key+'\');selCharMods.delete(\''+m.key+'\');renderCharModTags();renderCharModsArea();">✕</span>':''}`;
    d.onclick=()=>{selCharMods.has(m.key)?selCharMods.delete(m.key):selCharMods.add(m.key);d.classList.toggle('selected');renderCharModsArea();};
    c.appendChild(d);
  });
}
function renderWbModTags(){
  const c=document.getElementById('wb-mod-tags');c.innerHTML='';
  [...WB_MODS,...customWbMods].forEach(m=>{
    const d=document.createElement('div');d.className='tag-item'+(selWbMods.has(m.key)?' selected':'');
    d.textContent=m.icon+' '+m.label;
    d.onclick=()=>{selWbMods.has(m.key)?selWbMods.delete(m.key):selWbMods.add(m.key);d.classList.toggle('selected');renderWbModsArea();};
    c.appendChild(d);
  });
}
function removeCustomMod(type,key){
  if(type==='char'){customCharMods=customCharMods.filter(m=>m.key!==key);selCharMods.delete(key);renderCharModTags();renderCharModsArea();}
  else{customWbMods=customWbMods.filter(m=>m.key!==key);selWbMods.delete(key);renderWbModTags();renderWbModsArea();}
}
function addCustomMod(type){
  const n=prompt('自定义模块名称：');if(!n||!n.trim())return;
  const k=(type==='char'?'cc_':'cw_')+Date.now();
  const mod={key:k,label:n.trim(),icon:'🔖'};
  if(type==='char'){customCharMods.push(mod);selCharMods.add(k);renderCharModTags();renderCharModsArea();}
  else{customWbMods.push(mod);selWbMods.add(k);renderWbModTags();renderWbModsArea();}
}
function renderCharModsArea(){
  const a=document.getElementById('char-mods-area');const ex={};
  a.querySelectorAll('.mc').forEach(c=>{const ta=c.querySelector('textarea');if(ta)ex[c.dataset.key]=ta.value;});
  a.innerHTML='';
  [...CHAR_MODS,...customCharMods].filter(m=>selCharMods.has(m.key)).forEach(m=>{
    const d=document.createElement('div');d.className='mc';d.dataset.key=m.key;
    d.innerHTML=`<div class="mc-h collapsed" onclick="togMC(this)"><span>${m.icon} ${m.label}</span><span class="arr">▼</span></div><div class="mc-b hid"><label>额外要求</label><textarea rows="2" placeholder="对「${m.label}」的具体要求…">${ex[m.key]||''}</textarea><div style="display:flex;gap:5px;margin-top:5px"><button class="btn btn-s btn-sm" onclick="genSingleCharMod('${m.key}')">🎲 单独生成</button></div><div class="ri-err" id="err-char-${m.key}"></div></div>`;
    a.appendChild(d);
  });
}
function renderWbModsArea(){
  const a=document.getElementById('wb-mods-area');const ex={};
  a.querySelectorAll('.mc').forEach(c=>{const ta=c.querySelector('textarea');if(ta)ex[c.dataset.key]=ta.value;});
  a.innerHTML='';
  [...WB_MODS,...customWbMods].filter(m=>selWbMods.has(m.key)).forEach(m=>{
    const d=document.createElement('div');d.className='mc';d.dataset.key=m.key;
    d.innerHTML=`<div class="mc-h collapsed" onclick="togMC(this)"><span>${m.icon} ${m.label}</span><span class="arr">▼</span></div><div class="mc-b hid"><label>内容要求</label><textarea rows="2" placeholder="对「${m.label}」的具体要求…">${ex[m.key]||''}</textarea><div class="row2 mt4"><div><label>条目数</label><select id="wbc-${m.key}"><option value="auto" selected>自动</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option></select></div><div><label>触发</label><select id="wbt-${m.key}"><option value="keyword">关键词</option><option value="always">始终</option></select></div></div><div style="margin-top:5px"><button class="btn btn-s btn-sm" onclick="genSingleWbMod('${m.key}')">🎲 单独生成</button></div><div class="ri-err" id="err-wb-${m.key}"></div></div>`;
    a.appendChild(d);
  });
}

// ==================== 多人模式 ====================
function toggleMulti(on){
  document.getElementById('multi-area').style.display=on?'block':'none';
  if(on&&!multiChars.length){multiChars.push({name:'',brief:''});renderMultiChars();}
}
function addMultiChar(){multiChars.push({name:'',brief:''});renderMultiChars();}
function renderMultiChars(){
  const a=document.getElementById('multi-chars');a.innerHTML='';
  multiChars.forEach((c,i)=>{
    const d=document.createElement('div');
    d.style.cssText='background:var(--ibg);border:1px solid var(--bd);border-radius:7px;padding:8px;margin-bottom:6px';
    d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:var(--ac)">角色 ${i+1}</span>${i>0?`<button class="btn btn-d btn-sm" onclick="multiChars.splice(${i},1);renderMultiChars()">✕</button>`:''}</div><div class="row2"><div><label>角色名</label><input type="text" value="${esc(c.name)}" placeholder="角色名" oninput="multiChars[${i}].name=this.value"></div><div><label>简述</label><input type="text" value="${esc(c.brief)}" placeholder="简短描述" oninput="multiChars[${i}].brief=this.value"></div></div>`;
    a.appendChild(d);
  });
}

// ==================== 开场白 ====================
const lenMap={short:'100字内',medium:'200-400字',long:'500-800字',very_long:'800字以上',xxl:'1000-1500字',custom:'自定义'};
function syncOpReqs(){
  const n=parseInt(document.getElementById('op-count').value)||3;
  const a=document.getElementById('op-reqs');const exR=[],exL=[];
  a.querySelectorAll('.op-req-inp').forEach(el=>exR.push(el.value));
  a.querySelectorAll('.op-len-inp').forEach(el=>exL.push(el.value));
  a.innerHTML='';
  for(let i=0;i<n;i++){
    a.innerHTML+=`<div style="display:flex;gap:5px;align-items:center;margin-bottom:5px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--tx2);min-width:36px">第${i+1}条:</span>
      <input type="text" class="op-req-inp" placeholder="特殊要求（留空AI自由）" value="${exR[i]||''}" style="flex:1;min-width:100px">
      <select class="op-len-inp" style="width:100px">
        <option value="">默认字数</option>
        <option value="short">简短</option><option value="medium">中等</option><option value="long">详细</option>
        <option value="very_long">长篇</option><option value="xxl">超长1500</option>
        <option value="custom">自定义</option>
      </select>
      <input type="number" class="op-clen-inp" placeholder="自定义字数" style="width:80px;display:none" value="600">
    </div>`;
  }
  a.querySelectorAll('.op-len-inp').forEach((sel,i)=>{
    if(exL[i])sel.value=exL[i];
    sel.onchange=function(){const ci=this.closest('div').querySelector('.op-clen-inp');if(ci)ci.style.display=this.value==='custom'?'block':'none';};
  });
}

function opPrev(){if(!GD.openings.length)return;opIdx=Math.max(0,opIdx-1);renderOpCur();}
function opNext(){if(!GD.openings.length)return;opIdx=Math.min(GD.openings.length-1,opIdx+1);renderOpCur();}
function renderOpCur(){
  const os=GD.openings;
  if(!os.length){document.getElementById('op-page-label').textContent='暂无开场白';document.getElementById('op-cur').innerHTML='<span style="font-size:11px;color:var(--tx2)">尚未生成</span>';document.getElementById('op-cur-edit').style.display='none';return;}
  if(opIdx>=os.length)opIdx=os.length-1;
  document.getElementById('op-page-label').textContent=`开场白 ${opIdx+1} / ${os.length} （${(os[opIdx]||'').length}字）`;
  document.getElementById('op-cur').textContent=os[opIdx]||'';
  document.getElementById('op-ta').value=os[opIdx]||'';
}
function toggleOpEdit(){
  opEditing=!opEditing;
  document.getElementById('op-cur').style.display=opEditing?'none':'block';
  document.getElementById('op-cur-edit').style.display=opEditing?'block':'none';
  if(opEditing)document.getElementById('op-ta').value=GD.openings[opIdx]||'';
  // save on toggle off
  if(!opEditing){GD.openings[opIdx]=document.getElementById('op-ta').value;renderOpCur();}
}
function copyOpCur(){if(GD.openings[opIdx])navigator.clipboard.writeText(GD.openings[opIdx]).then(()=>toast('已复制','success'));}
function delOpCur(){if(!GD.openings.length)return;GD.openings.splice(opIdx,1);if(opIdx>=GD.openings.length)opIdx=Math.max(0,GD.openings.length-1);renderOpCur();}
async function regenOpCur(){if(isGen)return;isGen=true;const n=document.getElementById('char-name').value||'角色';try{const r=await callApi(getApi('sub'),[{role:'system',content:getSysPrompt()},{role:'user',content:`为「${n}」重新生成1个第三人称开场白（200-400字）。只输出正文。`}]);GD.openings[opIdx]=r.trim();renderOpCur();toast('✅ 已重生成','success');}catch(e){toast('❌ '+e.message,'error');}finally{isGen=false;}}
async function aiModOpCur(){if(isGen)return;const fb=document.getElementById('op-fb').value.trim();if(!fb){toast('请输入修改意见','error');return;}isGen=true;try{const r=await callApi(getApi('sub'),[{role:'system',content:'你是开场白修改助手，只输出修改后完整内容。'},{role:'user',content:`原文：${GD.openings[opIdx]}\n\n修改意见：${fb}\n\n只输出修改后完整内容：`}]);GD.openings[opIdx]=r.trim();document.getElementById('op-ta').value=GD.openings[opIdx];renderOpCur();toast('✅ 修改完成','success');}catch(e){document.getElementById('op-cur-err').textContent='❌ '+e.message;document.getElementById('op-cur-err').classList.add('show');}finally{isGen=false;}}

// ==================== 结果渲染 ====================
function renderCharResults(){
  const a=document.getElementById('char-results');const m=GD.charMods||{};
  if(!Object.keys(m).length){a.innerHTML='<span style="font-size:11px;color:var(--tx2)">尚未生成</span>';return;}
  a.innerHTML='';
  // 显示头像
  if(charImg){document.getElementById('result-avatar-row').style.display='block';document.getElementById('result-avatar').src='data:'+charImgMime+';base64,'+charImg;}
  Object.entries(m).forEach(([label,content],i)=>{
    const d=document.createElement('div');d.className='ri';
    d.innerHTML=`<div class="ri-h"><span>📝 ${esc(label)}</span><div style="display:flex;gap:3px">
      <button class="btn btn-s btn-sm" title="放大编辑" onclick="expandTA('${esc(label)}',()=>GD.charMods[Object.keys(GD.charMods)[${i}]],v=>{GD.charMods[Object.keys(GD.charMods)[${i}]]=v;renderCharResults();syncResultsToMods();})">⛶</button>
      <button class="btn btn-s btn-sm" onclick="regenCharMod(${i})">🔄</button>
      <button class="btn btn-s btn-sm" onclick="navigator.clipboard.writeText(Object.values(GD.charMods)[${i}])">📋</button>
      <button class="btn btn-d btn-sm" onclick="delCharMod(${i})">✕</button>
    </div></div>
    <textarea rows="4">${esc(content)}</textarea>
    <div class="fb-row"><input type="text" id="cfb-${i}" placeholder="修改意见…"><button class="btn btn-s btn-sm" onclick="aiModChar(${i})">✨AI</button></div>
    <div class="ri-err" id="cerr-${i}"></div>`;
    d.querySelector('textarea').oninput=function(){const ks=Object.keys(GD.charMods);GD.charMods[ks[i]]=this.value;};
    a.appendChild(d);
  });
}

function renderWbResults(){
  const a=document.getElementById('wb-results');const es=GD.wbEntries||[];
  if(!es.length){a.innerHTML='<span style="font-size:11px;color:var(--tx2)">尚未生成</span>';return;}
  a.innerHTML=`<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">共 ${es.length} 个条目</div>`;
  es.forEach((e,i)=>{
    const enabled=e.enabled!==false;
    const isGreen=(e.position===1||e.position==='after_char');
    const wc=(e.content||'').length;
    const d=document.createElement('div');d.className='wb-card';
    d.innerHTML=`<div class="wb-card-h" onclick="togWbCard(this)">
      <span class="wb-name" style="color:${enabled?'var(--tx)':'var(--tx2)'}">${esc((e.category?'['+e.category+'] ':'')+e.name)}</span>
      <span class="wb-wc">${wc}字</span>
      <span class="wb-en" style="background:${enabled?'#d4edda':'#f8d7da'};color:${enabled?'#155724':'#721c24'};border:1px solid ${enabled?'#c3e6cb':'#f5c6cb'}" onclick="event.stopPropagation();GD.wbEntries[${i}].enabled=!GD.wbEntries[${i}].enabled;renderWbResults()">${enabled?'启用':'关闭'}</span>
      <span class="wb-light" style="background:${isGreen?'#d4edda':'#cce5ff'};color:${isGreen?'#155724':'#004085'};border:1px solid ${isGreen?'#c3e6cb':'#b8daff'}" onclick="event.stopPropagation();GD.wbEntries[${i}].position=GD.wbEntries[${i}].position===1?0:1;renderWbResults()">${isGreen?'绿灯':'蓝灯'}</span>
      <button class="wb-del" onclick="event.stopPropagation();GD.wbEntries.splice(${i},1);renderWbResults()">✕</button>
      <span class="wb-arr">▼</span>
    </div>
    <div class="wb-body">
      <div class="mb4"><label>条目名称</label><input type="text" value="${esc(e.name)}" oninput="GD.wbEntries[${i}].name=this.value"></div>
      <div class="mb4"><label>关键词（逗号分隔，无关键词留空）</label><input type="text" value="${esc((e.keywords||[]).join(', '))}" oninput="GD.wbEntries[${i}].keywords=this.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean)"></div>
      <div><label>内容</label><textarea rows="4" oninput="GD.wbEntries[${i}].content=this.value">${esc(e.content)}</textarea></div>
      <div class="fb-row mt4">
        <input type="text" id="wfb-${i}" placeholder="修改意见…">
        <button class="btn btn-s btn-sm" onclick="aiModWb(${i})">✨AI修改</button>
        <button class="btn btn-s btn-sm" onclick="expandTA('世界书:${esc(e.name)}',()=>GD.wbEntries[${i}].content,v=>{GD.wbEntries[${i}].content=v;renderWbResults();})">⛶</button>
        <button class="btn btn-s btn-sm" onclick="regenWbE(${i})">🔄</button>
      </div>
      <div class="ri-err" id="werr-${i}"></div>
    </div>`;
    a.appendChild(d);
  });
}
function togWbCard(hdr){
  const body=hdr.nextElementSibling,arr=hdr.querySelector('.wb-arr');
  const open=body.classList.contains('open');body.classList.toggle('open',!open);arr.classList.toggle('open',!open);
}

// ==================== 系统提示词 ====================
function getSysPrompt(){
  const custom=document.getElementById('sys-prompt').value.trim();
  if(custom)return custom;
  return '你是一位专注于角色构建的创作者，深谙如何以细节塑造独特灵魂。请根据用户需求，创作内容丰富、情感真实、逻辑自洽的角色卡内容。NSFW内容直接描述，不加审查。';
}
function loadDefaultSysPrompt(){
  document.getElementById('sys-prompt').value='你是一位专注于角色构建的创作者，深谙如何以细节塑造独特灵魂。\n你的任务是根据用户的需求，创作内容丰富、情感真实、逻辑自洽的角色卡。\n\n核心规则：\n1. 基于角色的性格逻辑来塑造一切描写\n2. 使用具体的细节而非空泛描述\n3. NSFW内容直接描述\n4. 每个模块内容独立完整\n5. 禁止使用emoji表情符号';
}
function loadSysPromptFile(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>document.getElementById('sys-prompt').value=ev.target.result;
  r.readAsText(f);
}

// ==================== 生成提示词 ====================
function getCharModReqs(){const r={};document.querySelectorAll('#char-mods-area .mc').forEach(c=>{const ta=c.querySelector('textarea');r[c.dataset.key]=ta?ta.value.trim():'';});return r;}

function buildCharPrompt(keys){
  const name=document.getElementById('char-name').value.trim()||'未命名';
  const brief=document.getElementById('char-brief').value.trim();
  const lang=document.getElementById('output-lang').value;
  const lenMode=document.getElementById('char-len-mode').value;
  const len=lenMode==='auto'?'AI自动决定':(lenMode==='custom'?document.getElementById('char-len').value:lenMode);
  const ref=buildRef();
  const reqs=getCharModReqs();
  const mods=[...CHAR_MODS,...customCharMods].filter(m=>keys?keys.includes(m.key):selCharMods.has(m.key));
  // 多人模式
  const multiOn=document.getElementById('multi-enable').checked;
  let multiPart='';
  if(multiOn&&multiChars.length>0){
    multiPart='\n\n多人角色卡模式，除主角外还有以下角色，需要同时包含每个角色的内容：\n';
    multiChars.forEach((c,i)=>{
      multiPart+=`角色${i+1}: ${c.name||'未命名'}${c.brief?' - '+c.brief:''} \n`;
    });
    multiPart+='请在每个模块中分别写明各角色的对应内容。';
  }
  const tags=charTags.length?'\n标签：'+charTags.join('、'):'';
  return `你是SillyTavern角色卡撰写助手，用${langMap[lang]||'中文'}输出。\n角色名：${name}\n${brief?'简述：'+brief:''}${tags}\n目标中文字数：约${len}字${multiPart}${ref}\n\n生成以下模块（每个模块用 === 模块名 === 开头）：\n${mods.map(m=>`- ${m.label}${reqs[m.key]?'（要求：'+reqs[m.key]+'）':'（自由发挥）'}`).join('\n')}\n\n内容丰富具体，NSFW直接描述，禁止emoji。`;
}

function buildWbPrompt(keys){
  const name=document.getElementById('char-name').value.trim()||'未命名';
  const brief=document.getElementById('char-brief').value.trim();
  const lang=document.getElementById('output-lang').value;
  const len=document.getElementById('wb-len').value;
  const ref=buildRef();
  const mods=[...WB_MODS,...customWbMods].filter(m=>keys?keys.includes(m.key):selWbMods.has(m.key));
  return `你是SillyTavern世界书撰写助手，用${langMap[lang]||'中文'}输出。\n世界/角色：${name}\n${brief?'简述：'+brief:''}\n目标中文字数：约${len}字${ref}\n\n生成以下板块：\n${mods.map(m=>{const ce=document.getElementById('wbc-'+m.key);const ct=ce?ce.value:'auto';return `- ${m.label}：${ct==='auto'?'AI决定数量':ct+'条'}`;}).join('\n')}\n\n格式：=== 板块名 ===\n[条目名]\n关键词：词1,词2\n内容：…\n---\n\n每个条目名必须不同且具体，NSFW直接描述，禁止emoji。`;
}

function buildOpPrompt(){
  const name=document.getElementById('char-name').value.trim()||'角色';
  const brief=document.getElementById('char-brief').value.trim();
  const count=parseInt(document.getElementById('op-count').value)||3;
  const globalLen=document.getElementById('op-len').value;
  const customLen=document.getElementById('op-custom-len').value;
  const gr=document.getElementById('op-req').value.trim();
  const un=document.getElementById('op-user').value.trim();
  const lang=document.getElementById('output-lang').value;
  const styles=[...document.querySelectorAll('#op-styles .tag-item.selected')].map(t=>t.textContent.trim());
  const ref=buildRef();
  const defaultLen=globalLen==='custom'?`${customLen}字`:lenMap[globalLen];
  let perReqs='';
  document.querySelectorAll('#op-reqs>div').forEach((row,i)=>{
    const req=row.querySelector('.op-req-inp')?.value.trim();
    const lenSel=row.querySelector('.op-len-inp')?.value;
    const customL=row.querySelector('.op-clen-inp')?.value;
    const thisLen=lenSel==='custom'?`${customL}字`:lenSel?lenMap[lenSel]:defaultLen;
    if(req||lenSel)perReqs+=`\n- 第${i+1}条（${thisLen}）${req?'：'+req:''}`;
  });
  return `你是SillyTavern开场白撰写助手，用${langMap[lang]||'中文'}输出。\n角色：${name}\n${brief?'简述：'+brief:''}${ref}\n\n生成${count}个开场白，默认约${defaultLen}。\n${styles.length?'风格：'+styles.join('、'):''}\n${gr?'全局要求：'+gr:''}${un?'\n用户称呼：'+un:''}${perReqs}\n\n格式：=== 开场白 1 ===\n内容…\n\n【重要规则】\n1. 全部使用第三人称（他/她/角色名），严禁第一人称「我」\n2. 场景各异，结尾创造互动机会\n3. 严禁emoji\n4. 语言生动，情感真实`;
}

// ==================== API调用 ====================
function getApi(role){
  const url=document.getElementById('api-url').value.trim();
  const key=document.getElementById('api-key').value.trim();
  const model=document.getElementById('api-model').value.trim();
  if(role==='sub'&&document.getElementById('use-sub').checked){
    return{url:document.getElementById('sub-url').value.trim()||url,key:document.getElementById('sub-key').value.trim()||key,model:document.getElementById('sub-model').value.trim()||model||'gpt-4o'};
  }
  return{url:url||'http://localhost:5000/api/v1',key,model:model||'gpt-4o'};
}

async function callApi(cfg,msgs,onChunk){
  const url=cfg.url.replace(/\/$/,'')+'/chat/completions';
  const h={'Content-Type':'application/json'};
  if(cfg.key)h['Authorization']='Bearer '+cfg.key;
  abortCtrl=new AbortController();
  const res=await fetch(url,{method:'POST',headers:h,body:JSON.stringify({model:cfg.model,messages:msgs,stream:!!onChunk,temperature:0.85,max_tokens:4096}),signal:abortCtrl.signal});
  if(!res.ok){const t=await res.text().then(t=>t.substring(0,300));throw new Error(`API ${res.status}: ${t}`);}
  if(onChunk){
    const reader=res.body.getReader();const dec=new TextDecoder();let full='';
    while(true){
      const{done,value}=await reader.read();if(done)break;
      const lines=dec.decode(value,{stream:true}).split('\n');
      for(const line of lines){
        if(!line.startsWith('data: '))continue;
        const d=line.slice(6).trim();if(d==='[DONE]')return full;
        try{const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';if(delta){full+=delta;onChunk(delta,full);}}catch{}
      }
    }
    return full;
  }else{return(await res.json()).choices?.[0]?.message?.content||'';}
}

// ==================== 生成控制 ====================
function setStatus(msg,type='info'){const el=document.getElementById('gen-status');el.className='status '+type;el.textContent=msg;
  // 生成中=蓝色info，成功=绿色，错误=红色
  if(msg.includes('生成')&&!msg.includes('✅')&&!msg.includes('❌'))toast(msg,'info',8000);
  else toast(msg,type,3000);
}
function setProg(p){const w=document.getElementById('gen-progress'),b=document.getElementById('gen-bar');if(p>=0){w.classList.add('vis');b.style.width=p+'%';}else{w.classList.remove('vis');b.style.width='0%';}}
function stopGen(){if(abortCtrl)abortCtrl.abort();isGen=false;setStatus('已停止','info');setProg(-1);}

async function genAll(){
  if(isGen)return;isGen=true;setProg(0);
  try{
    setStatus('正在生成全部内容（单次API调用）…','info');setProg(5);
    const charP=buildCharPrompt();
    const wbP=buildWbPrompt();
    const opP=buildOpPrompt();
    const name=document.getElementById('char-name').value.trim()||'角色';
    const lang=document.getElementById('output-lang').value;
    let mega='请在一次回复中完成以下所有内容，用'+(langMap[lang]||'中文')+'输出。\n\n';
    mega+='======== 第一部分：角色卡 ========\n'+charP+'\n\n';
    mega+='======== 第二部分：世界书 ========\n'+wbP+'\n\n';
    if(dynEnabled){mega+='======== 第三部分：动态状态栏 ========\n'+getDynPrompt(name)+'\n\n';}
    mega+='======== '+(dynEnabled?'第四':'第三')+'部分：开场白 ========\n'+opP;
    if(dynEnabled){mega+='\n\n【重要】每条开场白末尾必须附带状态栏实例，格式与第三部分状态栏规则一致。';}
    mega+='\n\n【输出分隔格式】\n- 角色卡模块: === 模块名 ===\n- 世界书板块: ===WB 板块名 === ，条目间用 --- 分隔\n- 动态状态栏: ===DYN 状态栏规则 === 和 ===DYN 正则JSON ===\n- 正则JSON用```json```代码块包裹\n- 开场白: ===OP 开场白 N ===';
    let full='';
    setProg(10);
    full=await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:mega}],(d,t)=>{full=t;setProg(Math.min(90,10+Math.round(t.length/80)));});
    setProg(92);
    _parseUnifiedResult(full,name);
    setStatus('✅ 全部完成！','success');setProg(100);
    saveHistory();setTimeout(()=>setProg(-1),2000);
  }catch(e){if(e.name!=='AbortError')setStatus('❌ '+e.message,'error');else setStatus('已停止','info');}
  finally{isGen=false;}
}
function _parseUnifiedResult(full,name){
  // 用===WB/===DYN/===OP标记分割四部分
  let charText='',wbText='',dynText='',opText='';
  const parts=full.split(/={3,}(?:WB|DYN|OP)?\s/);
  // 也尝试按"第X部分"分割
  const p1=full.indexOf('======== 第二部分');
  const p2=full.indexOf('======== 第三部分');
  const p3=full.indexOf('======== 第四部分');
  if(p1>0){
    charText=full.substring(0,p1);
    if(p2>0){wbText=full.substring(p1,p2);dynText=p3>0?full.substring(p2,p3):'';opText=full.substring(p3>0?p3:p2);}
    else{wbText=full.substring(p1);}
  }else{
    // 用===WB/===DYN/===OP标记
    const wbIdx=full.search(/===WB\s/);
    const dynIdx=full.search(/===DYN\s/);
    const opIdx2=full.search(/===OP\s/);
    charText=full.substring(0,wbIdx>0?wbIdx:full.length);
    if(wbIdx>0)wbText=full.substring(wbIdx,dynIdx>0?dynIdx:(opIdx2>0?opIdx2:full.length));
    if(dynIdx>0)dynText=full.substring(dynIdx,opIdx2>0?opIdx2:full.length);
    if(opIdx2>0)opText=full.substring(opIdx2);
  }
  // 角色卡
  const cm=parseMods(charText.replace(/===WB[\s\S]*/,'').replace(/===DYN[\s\S]*/,'').replace(/===OP[\s\S]*/,''));
  if(Object.keys(cm).length>0){GD.charMods=cm;renderCharResults();syncResultsToMods();}
  // 世界书  
  if(wbText){
    const wbClean=wbText.replace(/===WB\s*/g,'=== ').replace(/===DYN[\s\S]*/,'').replace(/===OP[\s\S]*/,'');
    const keep=GD.wbEntries.filter(e=>e.category==='动态状态');
    const parsed=parseWbEntries(wbClean);
    GD.wbEntries=parsed.length>0?[...parsed,...keep]:(wbClean.trim().length>50?[{name:name+'_世界书',category:'世界设定',keywords:[name],content:wbClean.trim(),enabled:true,position:0},...keep]:keep);
    renderWbResults();
  }
  // 动态状态栏
  if(dynEnabled&&dynText){
    // 兼容模型输出的不同标题格式；动态段落缺少标题时也尽量恢复正文和正则 JSON
    const wm=dynText.match(/(?:===+\s*(?:DYN\s*)?状态栏规则\s*===+|状态栏规则\s*[:：]?)\s*([\s\S]*?)(?=(?:===+\s*(?:DYN\s*)?(?:正则JSON|正则美化|正则)\s*===+|正则JSON|正则美化|$))/i);
    const rm=dynText.match(/(?:===+\s*(?:DYN\s*)?(?:正则JSON|正则美化|正则)\s*===+|(?:正则JSON|正则美化)\s*[:：])\s*([\s\S]*?)(?====+\s*OP|$)/i);
    let wbBody=wm?.[1]?.trim()||'';
    if(!wbBody){const fence=dynText.match(/```status\s*([\s\S]*?)```/i);if(fence)wbBody='请在每次回复末尾输出状态栏：\n```status\n'+fence[1].trim()+'\n```';}
    if(wbBody){GD.wbEntries.push({name:name+'_状态栏',category:'动态状态',keywords:['STATUS_START','[STATUS'],content:wbBody,enabled:true,position:0});try{document.getElementById('dyn-wb-content').value=wbBody;}catch{}renderWbResults();}
    if(rm&&rm[1].trim())_parseRegexJson(rm[1].trim(),name);
    else { const json=dynText.match(/```json\s*([\s\S]*?)```/i); if(json&&json[1].includes('findRegex'))_parseRegexJson(json[1],name); }
    const _mcd=document.getElementById('mc-dyn');if(_mcd)_mcd.style.display='block';
  }
  // 开场白
  if(opText){
    const oc=opText.replace(/===OP\s*/g,'=== ');
    const ops=parseOpenings(oc);
    if(ops.length>0&&ops[0].length>20){GD.openings=ops;opIdx=0;renderOpCur();}
  }
}


function _parseAllResult(full,name){
  // 分离角色卡部分
  const charSection=full.match(/={3,}\s*第一部分[\s\S]*?(?=={3,}\s*第二部分|={3,}\s*======== 第二|$)/)?.[0]||'';
  const wbSection=full.match(/={3,}\s*第二部分[\s\S]*?(?=={3,}\s*第三部分|={3,}\s*======== 第三|={3,}\s*第四|$)/)?.[0]||'';
  const dynSection=full.match(/={3,}\s*第三部分：动态[\s\S]*?(?=={3,}\s*第四部分|={3,}\s*======== 第四|$)/)?.[0]||'';
  const opSection=full.match(/={3,}\s*(?:第三|第四)部分：开场白[\s\S]*/)?.[0]||'';
  
  // 降级方案：如果分段标记不精确，按===WB/===DYN/===OP标记分割
  let charText=charSection||full;
  let wbText=wbSection;
  let dynText=dynSection;
  let opText=opSection;
  
  // 尝试用标记分割
  if(!wbText){
    const wbMatch=full.match(/===WB\s/); 
    if(wbMatch) wbText=full.substring(wbMatch.index);
  }
  if(!opText){
    const opMatch=full.match(/===OP\s/);
    if(opMatch) opText=full.substring(opMatch.index);
  }
  
  // 解析角色卡模块
  const charMods=parseMods(charText.replace(/===WB[\s\S]*/,''));
  if(Object.keys(charMods).length>0){
    GD.charMods=charMods;
    renderCharResults();syncResultsToMods();
  }
  
  // 解析世界书
  if(wbText){
    const wbClean=wbText.replace(/===WB\s*/g,'=== ').replace(/===OP[\s\S]*/,'').replace(/===DYN[\s\S]*/,'');
    const keepEntries=GD.wbEntries.filter(e=>e.category==='动态状态');
    const parsed=parseWbEntries(wbClean);
    if(parsed.length>0) GD.wbEntries=[...parsed,...keepEntries];
    else if(wbClean.trim().length>50){
      GD.wbEntries=[{name:name+'_世界书',category:'世界设定',keywords:[name],content:wbClean.trim(),enabled:true,position:0},...keepEntries];
    }
    renderWbResults();
  }
  
  // 解析动态状态栏
  if(dynEnabled && dynText){
    const wbMatch=dynText.match(/===(?:DYN)?\s*状态栏规则\s*===([\s\S]*?)(?====(?:DYN)?\s*正则JSON|===OP|$)/);
    const regexMatch=dynText.match(/===(?:DYN)?\s*正则JSON\s*===([\s\S]*?)(?====OP|$)/);
    const wbContent=wbMatch?wbMatch[1].trim():'';
    if(wbContent){
      GD.wbEntries.push({name:name+'_状态栏',category:'动态状态',keywords:['STATUS_START'],content:wbContent,enabled:true,position:0});
      try{document.getElementById('dyn-wb-content').value=wbContent;}catch{}
      renderWbResults();
    }
    if(regexMatch){
      const rtext=regexMatch[1].trim();
      const jm=rtext.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
      const rawJson=jm?jm[1].trim():rtext;
      _parseRegexJson(rawJson,name);
    }
    const _mcd=document.getElementById('mc-dyn');if(_mcd)_mcd.style.display='block';
  }
  
  // 解析开场白
  if(opText){
    const opClean=opText.replace(/===OP\s*/g,'=== ');
    const ops=parseOpenings(opClean);
    if(ops.length>0&&ops[0].length>20){
      GD.openings=ops;
      opIdx=0;renderOpCur();
    }
  }
}

function _parseRegexJson(rawInput,name){
  // 健壮解析：先提取```json```代码块（如有），再解析JSON
  let jsonStr=rawInput;
  // 尝试提取代码块
  const codeMatch=rawInput.match(/```(?:json)?\s*([\s\S]*?)```/);
  if(codeMatch) jsonStr=codeMatch[1].trim();
  // 尝试提取方括号包裹的数组
  jsonStr=jsonStr.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  if(!jsonStr.startsWith('[')&&!jsonStr.startsWith('{')){
    const arrMatch=jsonStr.match(/(\[[\s\S]*\])/);
    const objMatch=jsonStr.match(/(\{[\s\S]*\})/);
    if(arrMatch) jsonStr=arrMatch[1]; else if(objMatch) jsonStr=objMatch[1];
  }
  try{
    const parsed=JSON.parse(jsonStr);
    const list=Array.isArray(parsed)?parsed:[parsed];
    const normalized=list.filter(e=>e&&typeof e==='object').map((e,i)=>({
      scriptName:e.scriptName||e.script_name||e.name||(name+'_正则'+(i+1)),
      findRegex:e.findRegex||e.find_regex||e.search||e.pattern||e.find||'',
      replaceString:e.replaceString||e.replace_string||e.replace||e.replacement||e.output||'',
      trimStrings:e.trimStrings||[],
      placement:Array.isArray(e.placement)?e.placement:['AI_OUTPUT'],
      disabled:!!e.disabled,
      markdownOnly:e.markdownOnly!==undefined?!!e.markdownOnly:true,
      promptOnly:!!e.promptOnly,
      runOnEdit:e.runOnEdit!==undefined?!!e.runOnEdit:true,
      substituteRegex:e.substituteRegex!==undefined?!!e.substituteRegex:true
    }));
    if(normalized.length>0){
      GD.regexEntries.push(...normalized);
      if(!normalized[0].findRegex) toast('⚠️ 正则的findRegex为空，请手动补充','info');
    }
    renderRegexResults();
  }catch(e){
    console.warn('_parseRegexJson error:',e,jsonStr.substring(0,200));
    toast('⚠️ 正则JSON解析失败，请检查AI输出格式','error');
    // 不要把整个JSON塞进replaceString，而是存一个空的让用户手动填
    GD.regexEntries.push({scriptName:name+'_状态栏美化',findRegex:'（请手动填写）',replaceString:'（请手动填写）',trimStrings:[],placement:['AI_OUTPUT'],disabled:false,markdownOnly:true,runOnEdit:true,substituteRegex:true});
    renderRegexResults();
  }
}async function _genDyn(){const name=document.getElementById('char-name').value.trim()||'角色';const r=await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:getDynPrompt(name)}]);const wbMatch=r.match(/===\s*状态栏规则\s*===([\s\S]*?)(?===\s*正则JSON|$)/);const regexMatch=r.match(/===\s*(?:正则JSON|正则美化|正则)\s*===([\s\S]*)/);
const wbContent=wbMatch?wbMatch[1].trim():r;
if(document.getElementById('dyn-gen-wb').checked){document.getElementById('dyn-wb-content').value=wbContent;GD.wbEntries.push({name:name+'_状态栏',category:'动态状态',keywords:['STATUS_START'],content:wbContent,enabled:true,position:0});renderWbResults();}
if(regexMatch&&document.getElementById('dyn-gen-regex').checked){const rtext=regexMatch[1].trim();const jm=rtext.match(/```(?:json)?\s*([\s\S]*?)```/);const rc=jm?jm[1].trim():rtext;document.getElementById('dyn-regex-content').value=rc;try{const parsed=JSON.parse(rc);if(Array.isArray(parsed)){GD.regexEntries=[...GD.regexEntries,...parsed];renderRegexResults();}}catch{}}
document.getElementById('dyn-result').style.display='block';document.getElementById('mc-dyn').style.display='block';}
async function genCharOnly(){if(isGen)return;isGen=true;setStatus('生成角色卡…','info');setProg(10);try{await _genChar();setStatus('✅ 角色卡完成','success');setProg(100);setTimeout(()=>setProg(-1),1500);}catch(e){if(e.name!=='AbortError')setStatus('❌ '+e.message,'error');}finally{isGen=false;}}
async function genWbOnly(){if(isGen)return;isGen=true;setStatus('生成世界书…','info');setProg(10);try{await _genWb();setStatus('✅ 世界书完成','success');setProg(100);setTimeout(()=>setProg(-1),1500);}catch(e){if(e.name!=='AbortError')setStatus('❌ '+e.message,'error');}finally{isGen=false;}}
async function genOpOnly(){if(isGen)return;isGen=true;setStatus('生成开场白…','info');setProg(10);try{await _genOp();setStatus('✅ 开场白完成','success');setProg(100);setTimeout(()=>setProg(-1),1500);}catch(e){if(e.name!=='AbortError')setStatus('❌ '+e.message,'error');}finally{isGen=false;}}

async function _genChar(){
  let full='';
  await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:buildCharPrompt()}],(d,t)=>{full=t;});
  GD.charMods=parseMods(full);renderCharResults();syncResultsToMods();
}
async function _genWb(){
  let full='';
  await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:buildWbPrompt()}],(d,t)=>{full=t;});
  // Bug4修复：保留动态状态条目，追加新世界书条目
  const keepEntries=GD.wbEntries.filter(e=>e.category==='动态状态');
  const parsed=parseWbEntries(full);
  if(parsed.length>0){
    GD.wbEntries=[...parsed,...keepEntries];
  }else{
    const nm=document.getElementById('char-name').value.trim()||'世界设定';
    GD.wbEntries=[{name:nm+'_世界书',category:'世界设定',keywords:[nm],content:full.trim(),enabled:true,position:0},...keepEntries];
    toast('⚠️ 世界书格式不标准，已作为单条目保存','info');
  }
  renderWbResults();
}
async function _genOp(){
  let full='';
  await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:buildOpPrompt()}],(d,t)=>{full=t;});
  GD.openings=parseOpenings(full);opIdx=0;renderOpCur();
}

async function genSingleCharMod(key){
  if(isGen)return;isGen=true;
  const label=[...CHAR_MODS,...customCharMods].find(m=>m.key===key)?.label||key;
  const el=document.getElementById('err-char-'+key);
  if(el){el.textContent='';el.classList.remove('show');}
  setStatus(`生成「${label}」…`,'info');
  try{let full='';await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:buildCharPrompt([key])}],(d,t)=>{full=t;});
  const p=parseMods(full);GD.charMods[label]=Object.values(p)[0]||full.trim();renderCharResults();syncResultsToMods();setStatus(`✅「${label}」完成`,'success');}
  catch(e){if(el){el.textContent='❌ '+e.message;el.classList.add('show');}setStatus('❌ '+e.message,'error');}finally{isGen=false;}
}
async function genSingleWbMod(key){
  if(isGen)return;isGen=true;
  const label=[...WB_MODS,...customWbMods].find(m=>m.key===key)?.label||key;
  const el=document.getElementById('err-wb-'+key);
  if(el){el.textContent='';el.classList.remove('show');}
  setStatus(`生成「${label}」…`,'info');
  try{let full='';await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:buildWbPrompt([key])}],(d,t)=>{full=t;});
  GD.wbEntries=[...(GD.wbEntries||[]),...parseWbEntries(full)];renderWbResults();setStatus(`✅「${label}」完成`,'success');}
  catch(e){if(el){el.textContent='❌ '+e.message;el.classList.add('show');}setStatus('❌ '+e.message,'error');}finally{isGen=false;}
}

// ==================== 单条AI修改 ====================
async function aiModChar(i){
  if(isGen)return;const ks=Object.keys(GD.charMods);const label=ks[i];const fb=document.getElementById('cfb-'+i)?.value.trim();
  if(!fb){const el=document.getElementById('cerr-'+i);if(el){el.textContent='请输入修改意见';el.classList.add('show');}return;}
  isGen=true;
  try{const r=await callApi(getApi('sub'),[{role:'system',content:'你是角色卡修改助手，只输出修改后内容，不要任何解释或标题。'},{role:'user',content:`模块：${label}\n原文：${GD.charMods[label]}\n\n修改意见：${fb}\n\n只输出修改后完整内容：`}]);
  GD.charMods[label]=r.trim();renderCharResults();syncResultsToMods();toast('✅ 修改完成','success');}
  catch(e){const el=document.getElementById('cerr-'+i);if(el){el.textContent='❌ '+e.message;el.classList.add('show');}}
  finally{isGen=false;}
}
async function regenCharMod(i){
  const ks=Object.keys(GD.charMods);const label=ks[i];
  const m=[...CHAR_MODS,...customCharMods].find(mm=>mm.label===label);
  if(m)genSingleCharMod(m.key);
}
function delCharMod(i){const ks=Object.keys(GD.charMods);if(ks[i])delete GD.charMods[ks[i]];renderCharResults();}

async function aiModWb(i){
  if(isGen)return;const e=GD.wbEntries[i];const fb=document.getElementById('wfb-'+i)?.value.trim();
  if(!fb){const el=document.getElementById('werr-'+i);if(el){el.textContent='请输入修改意见';el.classList.add('show');}return;}
  isGen=true;
  try{const r=await callApi(getApi('sub'),[{role:'system',content:'你是世界书修改助手，只输出修改后条目内容纯文本。'},{role:'user',content:`条目：${e.name}\n原文：${e.content}\n\n修改意见：${fb}\n\n只输出修改后内容：`}]);
  GD.wbEntries[i].content=r.trim();renderWbResults();toast('✅ 修改完成','success');}
  catch(e2){const el=document.getElementById('werr-'+i);if(el){el.textContent='❌ '+e2.message;el.classList.add('show');}}
  finally{isGen=false;}
}
async function regenWbE(i){
  if(isGen)return;isGen=true;
  try{const e=GD.wbEntries[i];const r=await callApi(getApi('sub'),[{role:'system',content:getSysPrompt()},{role:'user',content:`重新生成世界书条目「${e.name}」（${e.category||''}）的内容，只输出内容正文：`}]);
  GD.wbEntries[i].content=r.trim();renderWbResults();toast('✅ 已重生成','success');}
  catch(e){const el=document.getElementById('werr-'+i);if(el){el.textContent='❌ '+e.message;el.classList.add('show');}}
  finally{isGen=false;}
}

// ==================== AI润色（逐条真正更新）====================
async function polishAll(){await _polish('all');}
async function polishChar(){await _polish('char');}
async function polishWb(){await _polish('wb');}
async function polishOp(){await _polish('op');}
async function _polish(target){
  if(isGen)return;const fb=document.getElementById('polish-text').value.trim();
  if(!fb){const ps=document.getElementById('polish-status');ps.className='status error';ps.textContent='请输入修改意见';return;}
  isGen=true;
  const ps=document.getElementById('polish-status');ps.className='status info';ps.textContent='润色中…';
  try{
    const api=getApi('sub');
    let count=0;
    if(target==='char'||target==='all'){
      for(const label of Object.keys(GD.charMods||{})){
        const r=await callApi(api,[{role:'system',content:'你是角色卡润色助手。只输出修改后的纯文本，不要加任何标题、代码块或解释。'},{role:'user',content:`请润色以下「${label}」内容：\n\n${GD.charMods[label]}\n\n修改意见：${fb}\n\n只输出修改后完整内容：`}]);
        if(r&&r.trim()){GD.charMods[label]=r.trim();count++;}
      }
      renderCharResults();syncResultsToMods();
    }
    if(target==='wb'||target==='all'){
      for(let i=0;i<(GD.wbEntries||[]).length;i++){
        const r=await callApi(api,[{role:'system',content:'你是世界书润色助手。只输出修改后条目内容纯文本。'},{role:'user',content:`润色条目「${GD.wbEntries[i].name}」：\n\n${GD.wbEntries[i].content}\n\n修改意见：${fb}\n\n只输出修改后内容：`}]);
        if(r&&r.trim()){GD.wbEntries[i].content=r.trim();count++;}
      }
      renderWbResults();
    }
    if(target==='op'||target==='all'){
      for(let i=0;i<(GD.openings||[]).length;i++){
        const r=await callApi(api,[{role:'system',content:'你是开场白润色助手。只输出修改后完整开场白，保持第三人称。'},{role:'user',content:`润色开场白${i+1}：\n\n${GD.openings[i]}\n\n修改意见：${fb}\n\n只输出修改后内容：`}]);
        if(r&&r.trim()){GD.openings[i]=r.trim();count++;}
      }
      renderOpCur();
    }
    ps.className='status success';ps.textContent=`✅ 润色完成，已更新 ${count} 项`;
  }catch(e){ps.className='status error';ps.textContent='❌ '+e.message;}
  finally{isGen=false;}
}

// ==================== AI一键修改 ====================
async function aiModAll(){
  if(isGen)return;const req=document.getElementById('ai-all-req').value.trim();
  if(!req){toast('请输入修改要求','error');return;}
  const doChar=document.getElementById('ck-char').checked;
  const doWb=document.getElementById('ck-wb').checked;
  const doOp=document.getElementById('ck-op').checked;
  if(!doChar&&!doWb&&!doOp){toast('请至少选择一项','error');return;}
  isGen=true;
  const prog=document.getElementById('ai-all-prog'),bar=document.getElementById('ai-all-bar');
  const st=document.getElementById('ai-all-status');
  document.getElementById('ai-all-btn').disabled=true;
  prog.classList.add('vis');bar.style.width='10%';st.className='status info';st.textContent='修改中…';
  let count=0;
  try{
    const api=getApi('sub');
    if(doChar){
      // 检查是否需要修改角色名
      const nameMatch=req.match(/角色名[改为变成叫]+[「"']?([^"'」，。,\s]+)/);
      if(nameMatch)document.getElementById('char-name').value=nameMatch[1];
      for(const label of Object.keys(GD.charMods||{})){
        const r=await callApi(api,[{role:'system',content:'你是角色卡修改助手。只输出修改后的纯文本内容，不要加标题。'},{role:'user',content:`请根据以下要求修改「${label}」：\n\n原文：${GD.charMods[label]}\n\n修改要求：${req}\n\n只输出修改后完整内容：`}]);
        if(r&&r.trim()){GD.charMods[label]=r.trim();count++;}
      }
      renderCharResults();syncResultsToMods();
    }
    bar.style.width='50%';
    if(doWb){
      for(let i=0;i<(GD.wbEntries||[]).length;i++){
        const r=await callApi(api,[{role:'system',content:'只输出修改后内容。'},{role:'user',content:`修改世界书条目「${GD.wbEntries[i].name}」：\n\n${GD.wbEntries[i].content}\n\n要求：${req}\n\n只输出修改后内容：`}]);
        if(r&&r.trim()){GD.wbEntries[i].content=r.trim();count++;}
      }
      renderWbResults();
    }
    bar.style.width='70%';
    const doDyn=document.getElementById('ck-dyn')?.checked;
    if(doDyn){
      // Fix8: 修改状态栏世界书条目
      for(let i=0;i<(GD.wbEntries||[]).length;i++){
        if(GD.wbEntries[i].category==='动态状态'){
          const r2=await callApi(api,[{role:'system',content:'只输出修改后内容。'},{role:'user',content:'修改动态状态栏条目：\n\n'+GD.wbEntries[i].content+'\n\n要求：'+req+'\n\n只输出修改后内容：'}]);
          if(r2&&r2.trim()){GD.wbEntries[i].content=r2.trim();count++;}
        }
      }
      renderWbResults();
      // 修改正则
      for(let i=0;i<(GD.regexEntries||[]).length;i++){
        if(GD.regexEntries[i].replaceString){
          const r3=await callApi(api,[{role:'system',content:'只输出修改后的正则replaceString内容。'},{role:'user',content:'修改正则替换内容：\n\n'+GD.regexEntries[i].replaceString+'\n\n要求：'+req+'\n\n只输出修改后replaceString：'}]);
          if(r3&&r3.trim()){GD.regexEntries[i].replaceString=r3.trim();count++;}
        }
      }
      renderRegexResults();
    }
    bar.style.width='80%';
    if(doOp){
      for(let i=0;i<(GD.openings||[]).length;i++){
        const r=await callApi(api,[{role:'system',content:'只输出修改后完整开场白，保持第三人称。'},{role:'user',content:`修改开场白${i+1}：\n\n${GD.openings[i]}\n\n要求：${req}\n\n只输出修改后内容：`}]);
        if(r&&r.trim()){GD.openings[i]=r.trim();count++;}
      }
      renderOpCur();
    }
    bar.style.width='100%';
    st.className='status success';st.textContent=`✅ 修改完成，已更新 ${count} 项`;
    toast('✅ 一键修改完成','success');
  }catch(e){st.className='status error';st.textContent='❌ '+e.message;}
  finally{isGen=false;document.getElementById('ai-all-btn').disabled=false;setTimeout(()=>prog.classList.remove('vis'),2000);}
}

// ==================== syncResultsToMods ====================
function syncResultsToMods(){
  const mods=GD.charMods||{};
  Object.entries(mods).forEach(([label,content])=>{
    const m=[...CHAR_MODS,...customCharMods].find(mm=>mm.label===label);
    if(m){const card=document.querySelector(`#char-mods-area .mc[data-key="${m.key}"]`);if(card){const ta=card.querySelector('textarea');if(ta&&!ta.value.trim())ta.value=content;}}
  });
}

// ==================== 动态状态 ====================
let dynCustomFields=[];
function addDynCustomField(){
  const name=prompt('自定义字段名称：');if(!name||!name.trim())return;
  dynCustomFields.push(name.trim());
  renderDynCustomTags();
}
function renderDynCustomTags(){
  const c=document.getElementById('dyn-custom-tags');
  c.innerHTML=dynCustomFields.map((f,i)=>`<div class="tag-item selected" style="display:inline-flex;align-items:center;gap:3px">${f}<span style="cursor:pointer;font-size:9px" onclick="event.stopPropagation();dynCustomFields.splice(${i},1);renderDynCustomTags()">✕</span></div>`).join('');
}
async function _genDyn(){
  const name=document.getElementById('char-name').value.trim()||'角色';
  const prompt=getDynPrompt(name);
  const r=await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:prompt}]);
  const wbMatch=r.match(/===\s*状态栏规则\s*===([\s\S]*?)(?===\s*正则JSON|$)/);
  const regexMatch=r.match(/===\s*(?:正则JSON|正则美化|正则)\s*===([\s\S]*)/);
  const wbContent=wbMatch?wbMatch[1].trim():r;
  if(document.getElementById('dyn-gen-wb').checked&&wbContent){
    GD.wbEntries.push({name:name+'_状态栏',category:'动态状态',keywords:['STATUS_START'],content:wbContent,enabled:true,position:0});
    renderWbResults();
  }
  if(document.getElementById('dyn-gen-regex').checked&&regexMatch){
    const rtext=regexMatch[1].trim();
    const jm=rtext.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed=jm?jm[1].trim():rtext;
    try{
      const arr=JSON.parse(parsed);
      const list=Array.isArray(arr)?arr:[arr];
      // Bug6修复：标准化字段名，支持AI多种输出格式
      const normalized=list.map((e,i)=>({
        scriptName:e.scriptName||e.script_name||e.name||e.id||(name+'_正则'+(i+1)),
        findRegex:e.findRegex||e.find_regex||e.search||e.pattern||e.find||'',
        replaceString:e.replaceString||e.replace_string||e.replace||e.replacement||e.output||'',
        enabled:true
      }));
      GD.regexEntries.push(...normalized);
      renderRegexResults();
    }catch{
      // JSON解析失败：存为可编辑条目
      toast('⚠️ 正则JSON格式异常，请手动编辑','info');
      GD.regexEntries.push({scriptName:name+'_状态栏美化',findRegex:'',replaceString:parsed,enabled:true});
      renderRegexResults();
    }
  }
}
function getDynPrompt(name){
  const customChk=document.getElementById('dyn-custom-chk').checked;
  const customContent=document.getElementById('dyn-custom-content').value.trim();
  if(customChk&&customContent) return customContent;
  const fields=[...document.querySelectorAll('#dyn-fields .tag-item.selected')].map(el=>el.dataset.f);
  if(dynCustomFields.length)fields.push(...dynCustomFields);
  const rules=document.getElementById('dyn-affection-rules').value.trim();
  const req=document.getElementById('dyn-req').value.trim();
  return `为SillyTavern角色「${name}」生成动态状态栏。

一、生成状态栏世界书条目（放入世界书，始终激活）：
要求AI在每次回复末尾输出一个代码块，格式如下：
\`\`\`status
【时间地点】...
【内心独白】...
【好感阶段】...
\`\`\`
包含字段：${fields.join('、')}。
${rules?'好感度规则：'+rules:''}
${req?'额外要求：'+req:''}

二、生成与状态栏对应的正则美化脚本（用于视觉美化显示）：
正则脚本必须能匹配上面状态栏的输出格式，并用HTML/CSS替换为美观的样式。

【重要】正则必须包含完整的findRegex和replaceString：
- findRegex: 用正则表达式匹配状态栏代码块，如 /\\x60\\x60\\x60status\\n([\\s\\S]*?)\\x60\\x60\\x60/g
- replaceString: 用HTML+内联CSS美化，如 <div style="background:linear-gradient(...);padding:12px;border-radius:8px;...">$1</div>

输出格式：
=== 状态栏规则 ===
（完整的世界书条目内容）

=== 正则美化 ===
\`\`\`json
[{
  "scriptName": "${name}_状态栏美化",
  "findRegex": "（完整的正则表达式字符串）",
  "replaceString": "（完整的HTML替换字符串，用内联CSS美化）",
  "placement": ["AI_OUTPUT"],
  "markdownOnly": true,
  "runOnEdit": true,
  "substituteRegex": true
}]
\`\`\``;
}
async function genDynamic(){
  if(!dynEnabled){toast('请先启用动态状态栏','error');return;}
  if(isGen)return;isGen=true;
  const name=document.getElementById('char-name').value.trim()||'角色';
  try{
    setStatus('生成动态状态…','info');
    const r=await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:getDynPrompt(name)}]);
    const wbMatch=r.match(/===\s*状态栏规则\s*===([\s\S]*?)(?===\s*正则JSON|$)/);
    const regexMatch=r.match(/===\s*(?:正则JSON|正则美化|正则)\s*===([\s\S]*)/);
    const wbContent=wbMatch?wbMatch[1].trim():r;
    document.getElementById('dyn-wb-content').value=wbContent;
    if(regexMatch){
      const rtext=regexMatch[1].trim();
      const jm=rtext.match(/```(?:json)?\s*([\s\S]*?)```/);
      const regexContent=jm?jm[1].trim():rtext;
      document.getElementById('dyn-regex-content').value=regexContent;
      // 解析并添加到正则结果
      try{
        const parsed=JSON.parse(regexContent);
        if(Array.isArray(parsed)||typeof parsed=="object"){
          const list=Array.isArray(parsed)?parsed:[parsed];
          const norm=list.map((e,i)=>({
            scriptName:e.scriptName||e.script_name||e.name||(name+'_正则'+(i+1)),
            findRegex:e.findRegex||e.find_regex||e.search||e.pattern||e.find||''  ,
            replaceString:e.replaceString||e.replace_string||e.replace||e.replacement||e.output||'',
            enabled:true
          }));
          GD.regexEntries=[...GD.regexEntries,...norm];
          renderRegexResults();
        }
      }catch{}
    }
    // 把状态栏规则加入世界书结果
    if(dynEnabled&&wbContent){
      GD.wbEntries.push({name:name+'_状态栏规则',category:'动态状态',keywords:['STATUS_START','[STATUS'],content:wbContent,enabled:true,position:0});
      renderWbResults();
    }
    document.getElementById('dyn-result').style.display='block';
    const _mcd=document.getElementById('mc-dyn');if(_mcd)_mcd.style.display='block';
    setStatus('✅ 动态状态生成完成','success');
  }catch(e){setStatus('❌ '+e.message,'error');}finally{isGen=false;}
}
async function genDynOnly(){if(isGen)return;/* simplified: same as genDynamic but without regex prompt */genDynamic();}
async function genRegexOnly(){
  if(isGen)return;isGen=true;
  try{
    const wbContent=document.getElementById('dyn-wb-content').value||document.getElementById('dyn-req').value;
    const r=await callApi(getApi('main'),[{role:'system',content:'你是正则表达式生成助手。'},{role:'user',content:`根据以下状态栏格式，生成可导入SillyTavern的正则美化JSON数组。只输出JSON：\n\n${wbContent}`}]);
    const jm=r.match(/```(?:json)?\s*([\s\S]*?)```/);const rtext=jm?jm[1].trim():r;
    document.getElementById('dyn-regex-content').value=rtext;
    document.getElementById('dyn-result').style.display='block';
    toast('✅ 正则已生成','success');
  }catch(e){toast('❌ '+e.message,'error');}finally{isGen=false;}
}
// ==================== 正则结果 ====================
function renderRegexResults(){
  const a=document.getElementById('regex-results');
  if(!GD.regexEntries||!GD.regexEntries.length){a.innerHTML='<span style="font-size:11px;color:var(--tx2)">暂无正则</span>';return;}
  a.innerHTML='';
  GD.regexEntries.forEach((e,i)=>{
    const d=document.createElement('div');d.className='wb-card';
    const name=e.scriptName||e.name||e.id||('正则 '+(i+1));
    d.innerHTML=`<div class="wb-card-h" onclick="togWbCard(this)">
      <span class="wb-name">${esc(name)}</span>
      <span class="wb-wc">${(e.findRegex||'').length}字</span>
      <button class="wb-del" onclick="event.stopPropagation();GD.regexEntries.splice(${i},1);renderRegexResults()">✕</button>
      <span class="wb-arr">▼</span>
    </div>
    <div class="wb-body">
      <div class="mb4"><label>名称</label><input type="text" value="${esc(name)}" oninput="if(GD.regexEntries[${i}])GD.regexEntries[${i}].scriptName=this.value"></div>
      <div class="mb4"><label>查找正则</label><input type="text" value="${esc(e.findRegex||'')}" oninput="GD.regexEntries[${i}].findRegex=this.value"></div>
      <div><label>替换内容</label><textarea rows="3" oninput="GD.regexEntries[${i}].replaceString=this.value">${esc(e.replaceString||'')}</textarea></div>
    </div>`;
    a.appendChild(d);
  });
}
function addRegexEntry(){
  GD.regexEntries.push({scriptName:'新正则',findRegex:'',replaceString:'',enabled:true});
  renderRegexResults();
}

function addDynToWB(){
  const content=document.getElementById('dyn-wb-content').value.trim();if(!content){toast('暂无状态栏内容','error');return;}
  const name=document.getElementById('char-name').value.trim()||'角色';
  GD.wbEntries.push({name:name+'_状态栏',category:'动态状态',keywords:['STATUS'],content,enabled:true,position:0});
  renderWbResults();
  toast('✅ 已加入世界书','success');
}
function exportRegex(){
  if(!GD.regexEntries||!GD.regexEntries.length){
    // Fallback: try the textarea content
    const content=document.getElementById('dyn-regex-content').value.trim();
    if(!content){toast('暂无正则内容','error');return;}
    const blob=new Blob([content],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='regex.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    toast('✅ 已导出','success');return;
  }
  // ST regex format
  const stRegex=GD.regexEntries.map((e,i)=>({
    id:e.id||('regex_'+(i+1)+'_'+Date.now()),
    id:e.id||('regex_'+Date.now()+'_'+i),
    scriptName:e.scriptName||e.name||('正则'+(i+1)),
    findRegex:e.findRegex||'',
    replaceString:e.replaceString||'',
    trimStrings:e.trimStrings||[],
    placement:e.placement||['AI_OUTPUT'],
    disabled:false,
    markdownOnly:e.markdownOnly||false,
    promptOnly:false,
    runOnEdit:e.runOnEdit!==undefined?e.runOnEdit:true,
    substituteRegex:e.substituteRegex!==undefined?e.substituteRegex:true,
    minActivationMessageId:0,
    maxActivationMessageId:0
  }));
  const blob=new Blob([JSON.stringify(stRegex,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='regex_scripts.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast('✅ 正则已导出，在酒馆扩展>正则脚本中导入','success');
}

// ==================== 解析 ====================
function parseMods(t){const r={};const s=t.split(/===\s*(.+?)\s*===/);for(let i=1;i<s.length;i+=2)r[s[i].trim()]=(s[i+1]||'').trim();return r;}
function parseWbEntries(t){
  const es=[];const s=t.split(/===\s*(.+?)\s*===/);
  for(let i=1;i<s.length;i+=2){
    const cat=s[i].trim();
    (s[i+1]||'').split(/^---$/m).forEach(item=>{
      item=item.trim();if(!item)return;
      const nm=item.match(/^\[(.+?)\]/);
      const kw=item.match(/关键词[：:]\s*(.+)/);
      const cn=item.match(/内容[：:]\s*([\s\S]+)/);
      es.push({name:nm?nm[1]:cat,category:cat,keywords:kw?kw[1].split(/[,，]/).map(s=>s.trim()).filter(Boolean):[],content:cn?cn[1].trim():item,enabled:true,position:0});
    });
  }
  return es;
}
function parseOpenings(t){const s=t.split(/===\s*开场白\s*\d+\s*===/);const r=s.slice(1).map(s=>s.trim()).filter(Boolean);return r.length?r:[t.trim()];}

// ==================== 导出 ====================
function buildCharJson(){
  const name=document.getElementById('char-name').value.trim()||'未命名';
  const desc=Object.entries(GD.charMods||{}).map(([k,v])=>`${k}:\n${v}`).join('\n\n');
  const ops=GD.openings||[];
  const wbName=(document.getElementById('wb-name').value.trim()||(name+' Lorebook'));
  // Bug3修复：读取creator_notes/character_version/creator输入框
  const creatorNotes=(document.getElementById('creator-notes')||{}).value||'';
  const charVersion=(document.getElementById('char-version')||{}).value||'1.0';
  const creatorName=(document.getElementById('creator-name')||{}).value||'';
  const result={spec:'chara_card_v2',spec_version:'2.0',data:{
    name,description:desc,personality:GD.charMods['性格']||'',scenario:'',
    first_mes:ops[0]||'',mes_example:'',creator_notes:creatorNotes,system_prompt:'',post_history_instructions:'',
    alternate_greetings:ops.slice(1),tags:charTags,creator:creatorName,character_version:charVersion,extensions:{}}};
  if(charImg)result.data.extensions={avatar_base64:charImg,avatar_mime:charImgMime};
  if((GD.wbEntries||[]).length){
    result.data.character_book={name:wbName,description:'',scan_depth:2,token_budget:2048,recursive_scanning:false,extensions:{},
      entries:(GD.wbEntries||[]).map((e,i)=>({id:i,keys:e.keywords||[],secondary_keys:[],comment:e.name||('条目'+(i+1)),content:e.content,constant:false,selective:true,insertion_order:100,enabled:e.enabled!==false,position:e.position===1?'after_char':'before_char',use_regex:false,extensions:{}}))};
  }
  result._worldName=wbName;
  // Fix7: 将正则脚本嵌入角色卡extensions（导出PNG时一并包含）
  if((GD.regexEntries||[]).length){
    result.data.extensions.regex_scripts=(GD.regexEntries||[]).map((e,i)=>({
      id:e.id||('regex_'+(i+1)+'_'+Date.now()),
      scriptName:e.scriptName||('正则'+(i+1)),
      findRegex:e.findRegex||'',
      replaceString:e.replaceString||'',
      trimStrings:e.trimStrings||[],
      placement:e.placement||['AI_OUTPUT'],
      disabled:false,markdownOnly:false,promptOnly:false,
      runOnEdit:true,substituteRegex:true
    }));
  }
  return result;
}
function dlJSON(data,fn){const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);}
function exportCharJSON(){if(!Object.keys(GD.charMods||{}).length){toast('请先生成','error');return;}dlJSON(buildCharJson(),(document.getElementById('char-name').value.trim()||'char')+'_card.json');toast('✅ 已导出','success');}
function exportWbJSON(){if(!(GD.wbEntries||[]).length){toast('请先生成','error');return;}const wbName=document.getElementById('wb-name').value.trim()||(document.getElementById('char-name').value.trim()||'世界书');const data={name:wbName+' Lorebook',entries:(GD.wbEntries||[]).map((e,i)=>({uid:i+1,key:e.keywords||[],keysecondary:[],comment:e.name,content:e.content,constant:false,selective:true,insertion_order:10,enabled:e.enabled!==false,position:'after_char',extensions:{}}))};dlJSON(data,(document.getElementById('char-name').value.trim()||'wb')+'_lorebook.json');toast('✅ 已导出','success');}
function exportAll(){dlJSON({character:buildCharJson(),openings:GD.openings||[]},(document.getElementById('char-name').value.trim()||'char')+'_full.json');toast('✅ 已导出','success');}

function exportCharPNG(){
  if(!charImg){toast('请先上传角色图片','error');return;}
  const json=JSON.stringify(buildCharJson());
  const b64json=btoa(unescape(encodeURIComponent(json)));
  const imgDataUrl='data:'+charImgMime+';base64,'+charImg;
  const tmpImg=new Image();
  tmpImg.onload=()=>{
    const canvas=document.createElement('canvas');canvas.width=tmpImg.width;canvas.height=tmpImg.height;
    canvas.getContext('2d').drawImage(tmpImg,0,0);
    const pngB64=canvas.toDataURL('image/png').split(',')[1];
    const bin=atob(pngB64);const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    let iendPos=-1,pos=8;
    while(pos<bytes.length){const len=((bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3])>>>0;const type=String.fromCharCode(bytes[pos+4],bytes[pos+5],bytes[pos+6],bytes[pos+7]);if(type==='IEND'){iendPos=pos;break;}pos+=12+len;}
    if(iendPos===-1){toast('PNG结构异常','error');return;}
    const kw=new TextEncoder().encode('chara');const val=new TextEncoder().encode(b64json);
    const cd=new Uint8Array(kw.length+1+val.length);cd.set(kw,0);cd[kw.length]=0;cd.set(val,kw.length+1);
    const tb=new Uint8Array([0x74,0x45,0x58,0x74]);const lb=new Uint8Array(4);
    lb[0]=(cd.length>>>24)&0xFF;lb[1]=(cd.length>>>16)&0xFF;lb[2]=(cd.length>>>8)&0xFF;lb[3]=cd.length&0xFF;
    const crcTbl=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c;}return t;})();
    function crc32(d){let c=0xFFFFFFFF;for(let i=0;i<d.length;i++)c=crcTbl[(c^d[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
    const ci=new Uint8Array(tb.length+cd.length);ci.set(tb,0);ci.set(cd,tb.length);
    const cv=crc32(ci);const cb=new Uint8Array(4);
    cb[0]=(cv>>>24)&0xFF;cb[1]=(cv>>>16)&0xFF;cb[2]=(cv>>>8)&0xFF;cb[3]=cv&0xFF;
    const before=bytes.slice(0,iendPos);const iend=bytes.slice(iendPos);
    const chunk=new Uint8Array(lb.length+tb.length+cd.length+cb.length);
    let off=0;chunk.set(lb,off);off+=4;chunk.set(tb,off);off+=4;chunk.set(cd,off);off+=cd.length;chunk.set(cb,off);
    const result=new Uint8Array(before.length+chunk.length+iend.length);
    result.set(before,0);result.set(chunk,before.length);result.set(iend,before.length+chunk.length);
    const blob=new Blob([result],{type:'image/png'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=(document.getElementById('char-name').value.trim()||'char')+'.png';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    toast('✅ PNG已导出（可直接导入酒馆）','success');
  };
  tmpImg.src=imgDataUrl;
}

// ==================== 酒馆集成 ====================
async function createInTavern(){
  if(!Object.keys(GD.charMods||{}).length){toast('请先生成角色卡','error');return;}
  const d=buildCharJson();
  const el=document.getElementById('export-status');
  el.className='status info';el.textContent='正在上传…';
  toast('正在上传到酒馆…','info');
  try{
    // 方法1: 直接从iframe调用import API（与keke相同方式）
    const v2=JSON.stringify(d);
    const blob=new Blob([v2],{type:'application/json'});
    const fd=new FormData();
    fd.append('avatar',blob,(d.data?.name||'char')+'.json');
    fd.append('file_type','json');
    // Bug5修复：添加认证头，避免因缺少CSRF token而失败
    const importHdrs={}; // 不设Content-Type，让浏览器自动设置multipart boundary
    try{const hh=window.parent?.SillyTavern?.getContext()?.getRequestHeaders?.();if(hh){Object.keys(hh).forEach(k=>{if(k.toLowerCase()!=='content-type')importHdrs[k]=hh[k];});}}catch{}
    const res=await fetch('/api/characters/import',{method:'POST',headers:importHdrs,body:fd});
    if(res.ok){
      const r=await res.json().catch(()=>({}));
      // 上传头像
      if(charImg&&r.file_name){
        try{
          const byteStr=atob(charImg);
          const arr=new Uint8Array(byteStr.length);
          for(let i=0;i<byteStr.length;i++)arr[i]=byteStr.charCodeAt(i);
          const avFd=new FormData();
          avFd.append('avatar',new Blob([arr],{type:'image/png'}),(d.data?.name||'char')+'.png');
          avFd.append('avatar_url',r.file_name+'.png');
          await fetch('/api/characters/edit-avatar',{method:'POST',body:avFd}).catch(()=>{});
        }catch(ae){console.warn('avatar upload:',ae);}
      }
      el.className='status success';el.textContent='✅ 已成功创建角色！';
      toast('✅ 角色卡已上传到酒馆！','success');
    }else{
      // 方法2: 通过父页面postMessage
      const d2=buildCharJson();
      if(charImg)d2._avatarBase64=charImg;
      window.parent.postMessage({type:'cm-create-character',data:d2},'*');
    }
  }catch(e){
    // 方法2: 通过父页面
    const d2=buildCharJson();
    if(charImg)d2._avatarBase64=charImg;
    window.parent.postMessage({type:'cm-create-character',data:d2},'*');
  }
}
async function overwriteCurrent(){
  if(!Object.keys(GD.charMods||{}).length){toast('请先生成角色卡','error');return;}
  const d=buildCharJson();
  if(charImg)d._avatarBase64=charImg;
  window.parent.postMessage({type:'cm-overwrite-character',data:d},'*');
  toast('正在覆盖…','info');
}

// ==================== 图片处理 ====================
function handleImgUpload(e){
  const f=e.target.files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    document.getElementById('img-hint').style.display='none';
    const img=document.getElementById('img-full');
    img.src=ev.target.result;
    img.onload=()=>{
      // Bug2修复：先显示覆盖层让容器有尺寸，再用rAF定位裁剪框
      document.getElementById('img-crop-overlay').style.display='block';
      initCropDrag();
      requestAnimationFrame(()=>{
        const cont=document.getElementById('img-crop-container');
        const box=document.getElementById('crop-box');
        const boxW=cont.offsetWidth||300;
        const ratio=img.naturalHeight/Math.max(img.naturalWidth,1);
        const boxH=Math.round(boxW*ratio)||boxW;
        // 初始裁剪框居中，正方形，占容器较短边80%
        const initSize=Math.round(Math.min(boxW,boxH)*0.8);
        box.style.left=Math.round((boxW-initSize)/2)+'px';
        box.style.top=Math.round((boxH-initSize)/2)+'px';
        box.style.width=initSize+'px';
        box.style.height=initSize+'px';
      });
    };
    charImgMime=f.type||'image/png';
  };
  reader.readAsDataURL(f);
}
function confirmCrop(){
  const cont=document.getElementById('img-crop-container');
  const img=document.getElementById('img-full');
  const box=document.getElementById('crop-box');
  const scl=img.naturalWidth/cont.offsetWidth;
  const cx=parseFloat(box.style.left)*scl,cy=parseFloat(box.style.top)*scl;
  const cw=parseFloat(box.style.width)*scl,ch=parseFloat(box.style.height)*scl;
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(cw);canvas.height=Math.round(ch);
  canvas.getContext('2d').drawImage(img,cx,cy,cw,ch,0,0,cw,ch);
  const dataUrl=canvas.toDataURL('image/png');
  charImg=dataUrl.split(',')[1];charImgMime='image/png';
  document.getElementById('img-preview-img').src=dataUrl;
  document.getElementById('img-crop-overlay').style.display='none';
  document.getElementById('img-preview').style.display='block';
}
function cancelCrop(){document.getElementById('img-crop-overlay').style.display='none';}
function recropImg(){document.getElementById('img-preview').style.display='none';document.getElementById('img-crop-overlay').style.display='block';}
function removeImg(){charImg=null;document.getElementById('img-preview').style.display='none';document.getElementById('img-crop-overlay').style.display='none';document.getElementById('img-hint').style.display='block';}
function initCropDrag(){
  const box=document.getElementById('crop-box');const cont=document.getElementById('img-crop-container');const handle=document.getElementById('crop-handle');
  let mode=null,sx,sy,sl,st,sw,sh;
  function start(e,m){mode=m;const t=e.touches?e.touches[0]:e;sx=t.clientX;sy=t.clientY;const r=box.getBoundingClientRect();sl=box.offsetLeft;st=box.offsetTop;sw=box.offsetWidth;sh=box.offsetHeight;e.preventDefault();}
  box.onmousedown=e=>{if(e.target!==handle)start(e,'move');};
  box.ontouchstart=e=>{if(e.target!==handle)start(e,'move');};
  handle.onmousedown=e=>start(e,'resize');
  handle.ontouchstart=e=>start(e,'resize');
  function move(e){
    if(!mode)return;const t=e.touches?e.touches[0]:e;const dx=t.clientX-sx,dy=t.clientY-sy;
    const cw=cont.offsetWidth,ch=cont.offsetHeight;
    if(mode==='move'){box.style.left=Math.max(0,Math.min(cw-sw,sl+dx))+'px';box.style.top=Math.max(0,Math.min(ch-sh,st+dy))+'px';}
    else{box.style.width=Math.max(40,Math.min(cw-box.offsetLeft,sw+dx))+'px';box.style.height=Math.max(40,Math.min(ch-box.offsetTop,sh+dy))+'px';}
  }
  document.addEventListener('mousemove',move);
  document.addEventListener('touchmove',move,{passive:false});
  document.addEventListener('mouseup',()=>mode=null);
  document.addEventListener('touchend',()=>mode=null);
}

// ==================== 标签 ====================
function addTag(){const i=document.getElementById('tag-input');const v=i.value.trim();if(v&&!charTags.includes(v)){charTags.push(v);renderTags();}i.value='';}
function rmTag(i){charTags.splice(i,1);renderTags();}
function renderTags(){document.getElementById('char-tags').innerHTML=charTags.map((t,i)=>`<span style="display:inline-flex;align-items:center;gap:3px;background:var(--tagbg);color:var(--tagtx);border-radius:14px;padding:2px 9px;font-size:11px">${esc(t)}<span style="cursor:pointer" onclick="rmTag(${i})">×</span></span>`).join('');}
async function aiGenTags(){const n=document.getElementById('char-name').value||'角色';const b=document.getElementById('char-brief').value||'';if(isGen)return;isGen=true;try{const r=await callApi(getApi('main'),[{role:'system',content:'只输出2-3个标签，逗号分隔，不要其他文字'},{role:'user',content:`为「${n}」(${b||'无简述'})生成2-3个分类标签`}]);r.split(/[,，、]/).map(s=>s.trim()).filter(Boolean).forEach(t=>{if(!charTags.includes(t))charTags.push(t);});renderTags();}catch(e){toast('❌ '+e.message,'error');}finally{isGen=false;}}

// ==================== 导入 ====================
function handleCardImport(e){
  const f=e.target.files[0];if(!f)return;
  const st=document.getElementById('import-status');
  if(f.name.endsWith('.json')){
    const r=new FileReader();r.onload=ev=>{
      try{importedCard=JSON.parse(ev.target.result);const d=importedCard.data||importedCard;
      st.className='status success';st.textContent='✅ 已读取: '+(d.name||'未命名');
      document.getElementById('import-name').textContent=d.name||'未命名';
      document.getElementById('import-info').innerHTML=`<div>描述: ${(d.description||'').substring(0,100)}</div><div>开场白: ${(d.first_mes||'').substring(0,60)}</div>`;
      document.getElementById('import-preview').style.display='block';
      }catch(err){st.className='status error';st.textContent='❌ JSON解析失败: '+err.message;}
    };r.readAsText(f);
  }else if(f.name.endsWith('.png')){
    const r=new FileReader();r.onload=ev=>{
      try{
        const bytes=new Uint8Array(ev.target.result);
        const txt=extractPNGText(bytes,'chara');
        if(txt){try{importedCard=JSON.parse(decodeURIComponent(escape(atob(txt))));}catch(e2){importedCard=JSON.parse(atob(txt));}const d=importedCard.data||importedCard;
          st.className='status success';st.textContent='✅ 已读取PNG: '+(d.name||'未命名');
          document.getElementById('import-name').textContent=d.name||'未命名';
          document.getElementById('import-preview').style.display='block';
          // Fix9: 从PNG提取图片作为头像
          try{
            const pngB64=btoa(String.fromCharCode(...new Uint8Array(ev.target.result).slice(0,Math.min(ev.target.result.byteLength,5000000))));
            importedCard._avatarBase64=pngB64;
          }catch{}
          // 从PNG提取图片数据作为头像
          try{
            const u8=new Uint8Array(ev.target.result);
            const canvas2=document.createElement('canvas');
            const tmpImg2=new Image();
            tmpImg2.onload=()=>{canvas2.width=tmpImg2.width;canvas2.height=tmpImg2.height;canvas2.getContext('2d').drawImage(tmpImg2,0,0);importedCard._avatarBase64=canvas2.toDataURL('image/png').split(',')[1];};
            tmpImg2.src=URL.createObjectURL(new Blob([u8],{type:'image/png'}));
          }catch{}
        }else{st.className='status error';st.textContent='❌ PNG中未找到角色数据';}
      }catch(err){st.className='status error';st.textContent='❌ PNG解析失败: '+err.message;}
    };r.readAsArrayBuffer(f);
  }else{st.className='status error';st.textContent='❌ 请上传.json或.png';}
}
function applyImport(){
  if(!importedCard){toast('请先导入文件','error');return;}
  const d=importedCard.data||importedCard;
  if(d.name)document.getElementById('char-name').value=d.name;
  if(d.description)document.getElementById('char-brief').value=d.description.substring(0,300);
  if(d.tags?.length){charTags=[...d.tags];renderTags();}
  if(d.first_mes||d.alternate_greetings?.length){GD.openings=[d.first_mes,...(d.alternate_greetings||[])].filter(Boolean);opIdx=0;renderOpCur();}
  // 导入到角色卡结果中并显示
  GD.charMods={};
  if(d.description)GD.charMods['描述']=d.description;
  if(d.personality)GD.charMods['性格']=d.personality;
  if(d.scenario)GD.charMods['场景']=d.scenario;
  if(d.system_prompt)GD.charMods['系统提示词']=d.system_prompt;
  if(d.mes_example)GD.charMods['对话示例']=d.mes_example;
  renderCharResults();
  if(d.character_book?.entries){
    const entries=Array.isArray(d.character_book.entries)?d.character_book.entries:Object.values(d.character_book.entries);
    GD.wbEntries=entries.map(e=>({name:e.comment||e.key?.[0]||'条目',category:'导入',keywords:Array.isArray(e.keys)?e.keys:(e.key||[]),content:e.content||'',enabled:e.enabled!==false,position:e.position==='after_char'?1:0}));
    renderWbResults();
  }
  // Fix9: 导入角色卡时更新头像
  if(importedCard._avatarBase64){
    charImg=importedCard._avatarBase64;
    charImgMime='image/png';
    document.getElementById('img-preview-img').src='data:image/png;base64,'+charImg;
    document.getElementById('img-preview').style.display='block';
    document.getElementById('img-hint').style.display='none';
    if(document.getElementById('result-avatar-row'))document.getElementById('result-avatar-row').style.display='block';
    if(document.getElementById('result-avatar'))document.getElementById('result-avatar').src='data:image/png;base64,'+charImg;
  }
  // Fix9b: 导入角色卡中的正则脚本
  if(d.extensions?.regex_scripts&&Array.isArray(d.extensions.regex_scripts)){
    GD.regexEntries=d.extensions.regex_scripts.map(e=>({scriptName:e.scriptName||'导入正则',findRegex:e.findRegex||'',replaceString:e.replaceString||'',trimStrings:e.trimStrings||[],placement:e.placement||['AI_OUTPUT'],disabled:false}));
    renderRegexResults();
  }
  // Fix-F: 导入角色卡时同步头像到结果预览
  if(importedCard._avatarBase64){
    charImg=importedCard._avatarBase64;
    charImgMime='image/png';
    const prevImg=document.getElementById('img-preview-img');
    if(prevImg){prevImg.src='data:image/png;base64,'+charImg;document.getElementById('img-preview').style.display='block';document.getElementById('img-hint').style.display='none';}
    const resRow=document.getElementById('result-avatar-row');
    const resImg=document.getElementById('result-avatar');
    if(resRow){resRow.style.display='block';}
    if(resImg){resImg.src='data:image/png;base64,'+charImg;}
  }
  // 导入角色卡中的正则脚本
  if(d.extensions?.regex_scripts&&Array.isArray(d.extensions.regex_scripts)){
    GD.regexEntries=d.extensions.regex_scripts.map(e=>({scriptName:e.scriptName||'导入正则',findRegex:e.findRegex||'',replaceString:e.replaceString||'',trimStrings:e.trimStrings||[],placement:e.placement||['AI_OUTPUT'],disabled:false,markdownOnly:e.markdownOnly||true,runOnEdit:true,substituteRegex:true}));
    renderRegexResults();
  }
  toast('✅ 已导入: '+d.name+'（内容已显示在结果模块中）','success');
}
async function aiModifyImport(){
  if(!importedCard||isGen)return;
  const d=importedCard.data||importedCard;
  const req=document.getElementById('import-req').value.trim();
  isGen=true;setStatus('AI修改中…','info');
  try{
    const r=await callApi(getApi('main'),[{role:'system',content:getSysPrompt()},{role:'user',content:`根据以下修改意见，重写这个角色卡的描述、开场白和世界书，输出格式保持 === 模块名 === 。\n\n原角色：${JSON.stringify(d,null,2).substring(0,3000)}\n\n修改意见：${req||'优化丰富内容'}\n\n请输出：=== 性格 ===\n内容...\n（等各模块）`}]);
    GD.charMods=parseMods(r);renderCharResults();syncResultsToMods();setStatus('✅ AI修改完成','success');
  }catch(e){setStatus('❌ '+e.message,'error');}finally{isGen=false;}
}
function extractPNGText(bytes,kw){
  let pos=8;
  while(pos<bytes.length){const len=((bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3])>>>0;const type=String.fromCharCode(bytes[pos+4],bytes[pos+5],bytes[pos+6],bytes[pos+7]);if(type==='tEXt'){const data=bytes.slice(pos+8,pos+8+len);let ni=-1;for(let j=0;j<data.length;j++){if(data[j]===0){ni=j;break;}}if(ni>=0){const key=new TextDecoder().decode(data.slice(0,ni));if(key===kw)return new TextDecoder().decode(data.slice(ni+1));}}if(type==='IEND')break;pos+=12+len;}
  return null;
}

// ==================== 配置 ====================
function saveConfig(){
  const c={url:document.getElementById('api-url').value.trim(),key:document.getElementById('api-key').value.trim(),model:document.getElementById('api-model').value.trim(),useSub:document.getElementById('use-sub').checked,subUrl:document.getElementById('sub-url').value.trim(),subKey:document.getElementById('sub-key').value.trim(),subModel:document.getElementById('sub-model').value.trim()};
  localStorage.setItem('cm5_config',JSON.stringify(c));setStatus('✅ 配置已保存','success');
}
function loadConfig(){
  const r=localStorage.getItem('cm5_config');if(!r)return;
  try{const c=JSON.parse(r);if(c.url)document.getElementById('api-url').value=c.url;if(c.key)document.getElementById('api-key').value=c.key;if(c.model)document.getElementById('api-model').value=c.model;if(c.useSub){document.getElementById('use-sub').checked=true;document.getElementById('sub-sec').style.display='block';}if(c.subUrl)document.getElementById('sub-url').value=c.subUrl;if(c.subKey)document.getElementById('sub-key').value=c.subKey;if(c.subModel)document.getElementById('sub-model').value=c.subModel;}catch{}
}
async function fetchModels(target){
  const url=(target==='sub'?document.getElementById('sub-url'):document.getElementById('api-url')).value.trim();
  const key=(target==='sub'?document.getElementById('sub-key'):document.getElementById('api-key')).value.trim();
  if(!url){toast('请填写API地址','error');return;}
  try{
    const h={'Content-Type':'application/json'};if(key)h['Authorization']='Bearer '+key;
    const res=await fetch(url.replace(/\/$/,'')+'/models',{headers:h});const d=await res.json();
    const ms=(d.data||d||[]).map(m=>m.id||m.name||m).filter(Boolean);
    const listEl=document.getElementById('model-list-'+target);
    listEl.style.display='block';
    listEl.innerHTML=ms.map(n=>`<div style="padding:3px 7px;cursor:pointer;font-size:11px;border-radius:4px;margin-bottom:2px;background:var(--ibg);border:1px solid var(--bd)" onclick="document.getElementById('${target==='main'?'api-model':'sub-model'}').value='${n.replace(/'/g,"\\'").replace(/"/g,'&quot;')}';document.getElementById('model-list-${target}').style.display='none'">${n}</div>`).join('');
    toast('加载 '+ms.length+' 个模型','success');
  }catch(e){toast('❌ '+e.message,'error');}
}
async function testApi(target){
  const elId=`api-test-${target}`;
  const el=document.getElementById(elId);
  const url=(target==='sub'?document.getElementById('sub-url'):document.getElementById('api-url')).value.trim();
  const key=(target==='sub'?document.getElementById('sub-key'):document.getElementById('api-key')).value.trim();
  if(!url){el.className='status error';el.textContent='请填写API地址';return;}
  el.className='status info';el.textContent='测试中…';
  try{
    const h={'Content-Type':'application/json'};if(key)h['Authorization']='Bearer '+key;
    const res=await fetch(url.replace(/\/$/,'')+'/models',{headers:h});
    if(res.ok){el.className='status success';el.textContent='✅ 连接成功！';}
    else{el.className='status error';el.textContent='❌ HTTP '+res.status;}
  }catch(e){el.className='status error';el.textContent='❌ '+e.message;}
}

// ==================== 预设 ====================
function applyPreset(type){
  const p={romance:{brief:'恋爱/情感向角色',mods:['personality','appearance','background','love','speech','likes'],wbMods:['world','relations']},rpg:{brief:'RPG冒险向角色',mods:['personality','appearance','background','skills','relationships'],wbMods:['world','magic','factions']},daily:{brief:'日常/轻松向角色',mods:['personality','appearance','background','daily','speech','likes'],wbMods:['world','places']},horror:{brief:'恐怖悬疑向角色',mods:['personality','appearance','background','secrets','speech'],wbMods:['world','events']},scifi:{brief:'科幻向角色',mods:['personality','appearance','background','skills'],wbMods:['world','factions','items']}};
  const preset=p[type];if(!preset)return;
  document.getElementById('char-brief').value=preset.brief;
  closeModal('modal-preset');setStatus('✅ 已应用预设','success');
}

// ==================== 记录（5槽位）====================
function saveHistory(){
  // Auto-save to slot 0
  saveToSlot(0);
}
function renderHistory(){
  const h=JSON.parse(localStorage.getItem('cm5_history')||'[]');
  const a=document.getElementById('history-list');
  let html='';
  for(let i=0;i<5;i++){
    const r=h[i];
    const hasData=!!(r&&r._data);
    html+=`<div class="slot-card">
      <div class="slot-info">
        <div class="slot-name">槽位 ${i+1}：${r?esc(r.name):'空档位'}</div>
        <div class="slot-time">${r?r.time:'尚未保存'}</div>
      </div>
      <div class="slot-btns">
        <button class="slot-save" onclick="saveToSlot(${i})">存入</button>
        <button class="slot-load" ${hasData?'':'disabled'} onclick="loadFromSlot(${i})">读取</button>
        <button class="slot-clear" ${hasData?'':'disabled'} onclick="clearSlot(${i})">清空</button>
      </div>
    </div>`;
  }
  a.innerHTML=html;
}
async function saveToSlot(i){
  const name=document.getElementById('char-name').value.trim()||'未命名';
  const now=new Date();const time=`${now.getMonth()+1}月${now.getDate()}日 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const h=JSON.parse(localStorage.getItem('cm5_history')||'[]');
  while(h.length<5)h.push(null);
  h[i]={name,time,_data:{charMods:JSON.parse(JSON.stringify(GD.charMods||{})),wbEntries:JSON.parse(JSON.stringify(GD.wbEntries||[])),openings:[...(GD.openings||[])],charName:name,brief:document.getElementById('char-brief').value,tags:[...charTags]}};
  localStorage.setItem('cm5_history',JSON.stringify(h));
  renderHistory();
  toast(`✅ 已存入槽位 ${i+1}`,'success');
}
function loadFromSlot(i){
  const h=JSON.parse(localStorage.getItem('cm5_history')||'[]');
  const r=h[i];if(!r||!r._data)return;
  GD.charMods=r._data.charMods||{};GD.wbEntries=r._data.wbEntries||[];GD.openings=r._data.openings||[];
  if(r._data.charName)document.getElementById('char-name').value=r._data.charName;
  if(r._data.brief)document.getElementById('char-brief').value=r._data.brief;
  if(r._data.tags){charTags=r._data.tags;renderTags();}
  opIdx=0;
  renderCharResults();renderWbResults();renderOpCur();syncResultsToMods();
  closeModal('modal-history');
  toast('✅ 已读取槽位 '+(i+1),'success');
}
function clearSlot(i){
  if(!confirm('确认清空槽位 '+(i+1)+'？'))return;
  const h=JSON.parse(localStorage.getItem('cm5_history')||'[]');
  while(h.length<5)h.push(null);
  h[i]=null;localStorage.setItem('cm5_history',JSON.stringify(h));
  renderHistory();
}

// ==================== 主题/字号 ====================
function setTheme(t,el){
  const themes={rose:'--bg:#fff8fa;--sf:#fff;--sf2:#fef0f4;--ac:#d4638a;--ac2:#e8a0b8;--tx:#3a2030;--tx2:#8a6070;--bd:#f0d0dd;--ibg:#fef8fa;--btn:#d4638a;--btntx:#fff;--tagbg:#fde6ee;--tagtx:#b04068',white:'--bg:#f9f9f9;--sf:#fff;--sf2:#f3f3f3;--ac:#5b6ef5;--ac2:#a0acf5;--tx:#1a1a2e;--tx2:#666;--bd:#e0e0e0;--ibg:#fafafa;--btn:#5b6ef5;--btntx:#fff;--tagbg:#eef;--tagtx:#5b6ef5',blue:'--bg:#f0f6ff;--sf:#fff;--sf2:#dbeafe;--ac:#2563eb;--ac2:#93c5fd;--tx:#1e3a5f;--tx2:#5882a8;--bd:#bcd4f5;--ibg:#f5f9ff;--btn:#2563eb;--btntx:#fff;--tagbg:#dbeafe;--tagtx:#1e40af',green:'--bg:#f0faf4;--sf:#fff;--sf2:#dcf5e4;--ac:#16a34a;--ac2:#86efac;--tx:#1a3a2a;--tx2:#4a7a5a;--bd:#b8dfc4;--ibg:#f5fdf8;--btn:#16a34a;--btntx:#fff;--tagbg:#dcf5e4;--tagtx:#166534',dark:'--bg:#0d1117;--sf:#161b22;--sf2:#1c2128;--ac:#e8a0b8;--ac2:#c06080;--tx:#e6edf3;--tx2:#8b949e;--bd:#30363d;--ibg:#21262d;--btn:#e8a0b8;--btntx:#1a1a2e;--tagbg:#1c2128;--tagtx:#e8a0b8',purple:'--bg:#1a0a2e;--sf:#2a1040;--sf2:#3a1a50;--ac:#c084fc;--ac2:#a855f7;--tx:#f5e6ff;--tx2:#c4a3e0;--bd:#5a2080;--ibg:#220e38;--btn:#c084fc;--btntx:#1a0a2e;--tagbg:#2a1040;--tagtx:#c084fc'};
  if(!themes[t])return;
  const root=document.documentElement;
  themes[t].split(';').forEach(s=>{const[k,v]=s.split(':');if(k&&v)root.style.setProperty(k.trim(),v.trim());});
  document.querySelectorAll('.theme-sw').forEach(el=>el.classList.remove('active'));
  if(el)el.classList.add('active');
  localStorage.setItem('cm5_theme',t);
}
function setFontSize(v){document.documentElement.style.setProperty('--fs',v+'px');document.getElementById('font-label').textContent=v+'px';localStorage.setItem('cm5_fs',v);}

// ==================== AI助手 ====================
function toggleAI(){
  aiOpen=!aiOpen;
  document.getElementById('ai-panel').classList.toggle('open',aiOpen);
  if(aiOpen&&!aiHist.length){
    addAIMsg('sys','🤖 你好！我可以帮你：\n① 商量角色卡怎么写\n② 修改界面美化（说「切换深夜蓝主题」）\n③ 改动模块配置建议\n④ 回答使用问题');
  }
}
function addAIMsg(role,text){aiHist.push({role,text});renderAIMsgs();}
function renderAIMsgs(){const a=document.getElementById('ai-msgs');a.innerHTML=aiHist.map(m=>`<div class="ai-m ${m.role}">${esc(m.text)}</div>`).join('');a.scrollTop=a.scrollHeight;}
function clearAI(){aiHist=[];renderAIMsgs();addAIMsg('sys','已清空，有什么可以帮你？');}
async function sendAI(){
  const inp=document.getElementById('ai-input');const text=inp.value.trim();if(!text)return;
  inp.value='';addAIMsg('user',text);
  const apiTarget=document.getElementById('ai-api-sel').value;
  const sysP=`你是「制卡工具」的内置AI助手，专注帮助用户创建SillyTavern角色卡。\n\n当前角色：${document.getElementById('char-name').value||'(未填)'}，简述：${document.getElementById('char-brief').value||'(未填)'}\n已生成：角色卡${Object.keys(GD.charMods).length}模块，世界书${GD.wbEntries.length}条，开场白${GD.openings.length}条\n\n你的四大职能：\n1.商量角色卡构思（针对当前角色给出具体建议）\n2.界面美化建议（回复中含[THEME:主题名]可切换主题）\n3.模块配置建议\n4.解答工具使用问题\n\n回复简洁有用，中文，涉及写作时给出具体文本示例。`;
  const msgs=[{role:'system',content:sysP},...aiHist.filter(m=>m.role!=='sys').map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}))];
  const idx=aiHist.length;addAIMsg('bot','思考中…');
  try{
    const api=getApi(apiTarget);
    const url=api.url.replace(/\/$/,'')+'/chat/completions';
    const h={'Content-Type':'application/json'};if(api.key)h['Authorization']='Bearer '+api.key;
    const res=await fetch(url,{method:'POST',headers:h,body:JSON.stringify({model:api.model,messages:msgs,temperature:0.7,max_tokens:1000,stream:true})});
    if(!res.ok){aiHist[idx]={role:'bot',text:'❌ API '+res.status};renderAIMsgs();return;}
    const reader=res.body.getReader();const dec=new TextDecoder();let full='';
    while(true){const{done,value}=await reader.read();if(done)break;const lines=dec.decode(value,{stream:true}).split('\n');for(const line of lines){if(!line.startsWith('data: '))continue;const d=line.slice(6).trim();if(d==='[DONE]')break;try{const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';if(delta){full+=delta;aiHist[idx]={role:'bot',text:full};renderAIMsgs();}}catch{}}}
    const tm=full.match(/\[THEME:(\w+)\]/i);
    if(tm){setTheme(tm[1],document.querySelector(`.theme-sw[data-t="${tm[1]}"]`));addAIMsg('sys','✅ 已切换主题: '+tm[1]);}
  }catch(e){aiHist[idx]={role:'bot',text:'❌ '+e.message};renderAIMsgs();}
}
function initAIPanelDrag(){
  const panel=document.getElementById('ai-panel');const hdr=document.getElementById('ai-ph');
  let d=false,sx,sy,sl,st;
  hdr.addEventListener('mousedown',e=>{d=true;const r=panel.getBoundingClientRect();sx=e.clientX;sy=e.clientY;sl=r.left;st=r.top;panel.style.right='auto';panel.style.transition='none';document.body.style.userSelect='none';});
  hdr.addEventListener('touchstart',e=>{d=true;const r=panel.getBoundingClientRect();sx=e.touches[0].clientX;sy=e.touches[0].clientY;sl=r.left;st=r.top;panel.style.right='auto';document.body.style.userSelect='none';},{passive:true});
  function move(cx,cy){if(!d)return;panel.style.left=(sl+cx-sx)+'px';panel.style.top=(st+cy-sy)+'px';}
  document.addEventListener('mousemove',e=>move(e.clientX,e.clientY));
  document.addEventListener('touchmove',e=>{if(d)move(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
  function end(){d=false;document.body.style.userSelect='';}
  document.addEventListener('mouseup',end);document.addEventListener('touchend',end);
}

// ==================== 放大编辑 ====================
let expandCb=null;
function expandTA(title,getVal,setValCb){
  document.getElementById('expand-title').textContent=title;
  const ta=document.getElementById('expand-ta');ta.value=getVal();
  document.getElementById('expand-count').textContent=ta.value.length+' 字';
  ta.oninput=()=>document.getElementById('expand-count').textContent=ta.value.length+' 字';
  expandCb=setValCb;
  document.getElementById('expand-save').onclick=()=>{if(expandCb)expandCb(ta.value);document.getElementById('expandModal').classList.remove('open');};
  document.getElementById('expandModal').classList.add('open');
  ta.focus();
}
function closeExpand(){document.getElementById('expandModal').classList.remove('open');}

// ==================== UI工具 ====================
function togSec(h){h.classList.toggle('collapsed');h.nextElementSibling.classList.toggle('hid');}
function togMC(h){h.classList.toggle('collapsed');h.nextElementSibling.classList.toggle('hid');}
function openModal(id){document.getElementById(id).classList.add('open');if(id==='modal-history')renderHistory();}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function toast(msg,type='info',dur=2800){
  const old=document.getElementById('cm-toast');if(old)old.remove();
  const t=document.createElement('div');t.id='cm-toast';t.className='toast '+type;t.textContent=msg;
  t.onclick=()=>t.remove();document.body.appendChild(t);
  if(type!=='info')setTimeout(()=>{if(t.parentNode)t.remove();},dur);
}
function esc(s){if(!s)return'';const d=document.createElement('div');d.textContent=String(s);return d.innerHTML;}

