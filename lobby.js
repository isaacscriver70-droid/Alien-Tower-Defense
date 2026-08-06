// =======================================================================
// LOBBY PAGE LOGIC
// =======================================================================
let currentMode="normal";
function setDifficultyMode(m){ if(MODES[m]) currentMode=m; sessionStorage.setItem("atd_selectedMode",m); }
window.setDifficultyMode=setDifficultyMode;

function deployDefenses(){
  sessionStorage.setItem("atd_selectedMode",currentMode);
  sessionStorage.setItem("atd_localCoop", localCoopMode?"1":"0");
  window.location.href="game.html?autostart=1";
}
window.deployDefenses=deployDefenses;
function goOnlineCoop(){
  window.location.href="game.html?coop=online";
}
window.goOnlineCoop=goOnlineCoop;

let localCoopMode=false;
function isMobileDevice(){ return ('ontouchstart' in window) || (navigator.maxTouchPoints>0); }
function initCoopNotice(){
  const notice=document.getElementById("coop-mobile-notice");
  if(notice) notice.style.display=isMobileDevice()?"flex":"none";
}
function dismissCoopNotice(){ const n=document.getElementById("coop-mobile-notice"); if(n) n.style.display="none"; }
window.dismissCoopNotice=dismissCoopNotice;
function toggleLocalCoop(){
  localCoopMode=!localCoopMode;
  const btn=document.getElementById("btn-local-coop");
  if(btn) btn.innerText="LOCAL CO-OP: "+(localCoopMode?"ON":"OFF");
  playSound("click");
}
window.toggleLocalCoop=toggleLocalCoop;

document.getElementById("loader").style.display="block";

initMetaData(function(){
  document.getElementById("loader").style.display="none";
  document.getElementById("meta-stats").style.display="block";
  document.getElementById("armory-panel").style.display="block";
  updateMenuUI();
  renderArmory();
  applySettingsToUI();
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  ensureQuestsFresh();
  initCoopNotice();
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme||"menu"));
});

function updateMenuUI(){
  const setText=(id,val)=>{ const el=document.getElementById(id); if(el) el.innerText=val; };
  setText("m-wave",metaData.bestWave ?? 0);
  setText("m-kills",metaData.biomass ?? 0);
  setText("m-lvl",metaData.goldLevel ?? 0);
  setText("m-gold",400+((metaData.goldLevel ?? 0)*50));
  const cost=50*((metaData.goldLevel ?? 0)+1);
  setText("meta-cost",cost);
  const buyBtn=document.getElementById("btn-buy-meta");
  if(buyBtn) buyBtn.disabled=(metaData.biomass ?? 0)<cost;
}

function saveProgressManually(){
  saveToStorage(metaData);
  const btn=document.getElementById("btn-save-lobby");
  const old=btn.innerText;
  btn.innerText="SAVED!";
  btn.disabled=true;
  setTimeout(()=>{ btn.innerText=old; btn.disabled=false; },1100);
}
window.saveProgressManually=saveProgressManually;

async function forceUpdateApp(){
  showConfirmModal(
    "This reloads the game and fetches the latest version. Your save progress lives in Local Storage and will NOT be touched. Continue?",
    async ()=>{
      const btn=document.getElementById("btn-update-app");
      if(btn){ btn.disabled=true; btn.innerText="UPDATING..."; }
      try{
        if("serviceWorker" in navigator){
          const regs=await navigator.serviceWorker.getRegistrations();
          for(const reg of regs){ await reg.unregister(); }
        }
        if("caches" in window){
          const keys=await caches.keys();
          for(const key of keys){ await caches.delete(key); }
        }
        if("indexedDB" in window && indexedDB.databases){
          try{
            const dbs=await indexedDB.databases();
            for(const db of dbs){
              if(db && db.name) await new Promise(res=>{
                const req=indexedDB.deleteDatabase(db.name);
                req.onsuccess=req.onerror=req.onblocked=res;
              });
            }
          }catch(e){}
        }
        try{ sessionStorage.clear(); }catch(e){}
        try{
          document.cookie.split(";").forEach(c=>{
            const name=c.split("=")[0].trim();
            if(name) document.cookie=name+"=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
          });
        }catch(e){}
      }catch(e){}
      location.reload();
    }
  );
}
window.forceUpdateApp=forceUpdateApp;

function requestMetaUpgrade(){
  const btn=document.getElementById("btn-buy-meta");
  btn.disabled=true;
  apiPost("buyMetaUpgrade")
    .then(res=>{
      if(res && res.data) migrateMetaData(res.data);
      if(res && res.success){ playSound("upgrade"); }
      else{ playSound("denied"); showAlertModal((res && res.message) || "Upgrade failed."); }
      updateMenuUI();
    })
    .catch(()=>{
      showAlertModal("Local save error - please check your browser storage settings and try again.");
      btn.disabled=false;
    });
}
window.requestMetaUpgrade=requestMetaUpgrade;

// ---------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------
function toggleSettings(){
  const panel=document.getElementById("settings-panel");
  const isHidden=panel.style.display==="none"||!panel.style.display;
  if(isHidden) populateLobbyThemeSelect(document.getElementById("lobby-theme-select"));
  panel.style.display=isHidden?"block":"none";
}
window.toggleSettings=toggleSettings;

function applySettingsToUI(){
  const s=metaData.settings || defaultSettings();
  const musicSlider=document.getElementById("music-vol-slider");
  const sfxSlider=document.getElementById("sfx-vol-slider");
  const muteToggle=document.getElementById("mute-toggle");
  const flashySlider=document.getElementById("flashy-level-slider");
  const autoReturnToggle=document.getElementById("autoreturn-toggle");
  const lobbySelect=document.getElementById("lobby-theme-select");
  if(musicSlider){ musicSlider.value=s.musicVolume; document.getElementById("music-vol-val").innerText=s.musicVolume; }
  if(sfxSlider){ sfxSlider.value=s.sfxVolume; document.getElementById("sfx-vol-val").innerText=s.sfxVolume; }
  if(muteToggle) muteToggle.checked=!!s.muted;
  if(flashySlider){ flashySlider.value=s.flashyLevel!==undefined?s.flashyLevel:100; document.getElementById("flashy-level-val").innerText=flashySlider.value; }
  if(autoReturnToggle) autoReturnToggle.checked=!!s.autoReturnSummon;
  if(lobbySelect && lobbySelect.options.length===0) populateLobbyThemeSelect(lobbySelect);
  if(lobbySelect) lobbySelect.value=s.lobbyTheme||"menu";
  showCustomThemeEditorIfNeeded(s.lobbyTheme||"menu");
}

function updateSetting(key,value){
  if(!metaData.settings) metaData.settings=defaultSettings();
  if(key==="muted"){
    metaData.settings.muted=!!value;
    AudioEngine.setMuted(metaData.settings.muted);
    if(!metaData.settings.muted) AudioEngine.playSfx("click");
  }else if(key==="lobbyTheme"){
    metaData.settings.lobbyTheme=value;
    applyLobbyBackground(value);
    AudioEngine.playMusic(lobbyMusicKeyFor(value));
    showCustomThemeEditorIfNeeded(value);
    playSound("click");
  }else if(key==="flashyLevel"){
    const v=Math.max(0,Math.min(100,parseInt(value,10)||0));
    metaData.settings.flashyLevel=v;
    applyFlashyLevel(v);
    const disp=document.getElementById("flashy-level-val");
    if(disp) disp.innerText=v;
    playSound("click");
  }else if(key==="autoReturnSummon"){
    metaData.settings.autoReturnSummon=!!value;
    playSound("click");
  }else{
    const v=Math.max(0,Math.min(100,parseInt(value,10)||0));
    metaData.settings[key]=v;
    if(key==="musicVolume"){
      AudioEngine.setMusicVolume(v/100);
      document.getElementById("music-vol-val").innerText=v;
      AudioEngine.playSfx("click");
    }else if(key==="sfxVolume"){
      AudioEngine.setSfxVolume(v/100);
      document.getElementById("sfx-vol-val").innerText=v;
      AudioEngine.playSfx("click");
    }
  }
  saveToStorage(metaData);
}
window.updateSetting=updateSetting;

function lobbyMusicOptions(sel){
  sel.innerHTML="";
  const opts=[["menu","Menu Theme"],["boss","Boss Theme"]];
  AREAS.forEach((a,i)=>opts.push(["area"+i,"Area "+(i+1)+" - "+a.name]));
  opts.forEach(([val,label])=>{ const o=document.createElement("option"); o.value=val; o.innerText=label; sel.appendChild(o); });
}
function showCustomThemeEditorIfNeeded(themeKey){
  const editor=document.getElementById("custom-theme-editor");
  if(!editor) return;
  if(themeKey && themeKey.startsWith("custom")){
    const idx=parseInt(themeKey.replace("custom",""),10);
    metaData.settings.customThemes=metaData.settings.customThemes||defaultCustomThemes();
    const slot=metaData.settings.customThemes[idx]||defaultCustomThemes()[idx];
    editor.style.display="flex";
    editor.dataset.slotIdx=idx;
    document.getElementById("custom-bg1").value=slot.bg1;
    document.getElementById("custom-bg2").value=slot.bg2;
    document.getElementById("custom-accent").value=slot.accent;
    const msel=document.getElementById("custom-music-select");
    if(msel.options.length===0) lobbyMusicOptions(msel);
    msel.value=slot.music;
  }else{
    editor.style.display="none";
  }
}
function updateCustomThemeField(field,value){
  const editor=document.getElementById("custom-theme-editor");
  const idx=parseInt(editor.dataset.slotIdx,10);
  metaData.settings.customThemes=metaData.settings.customThemes||defaultCustomThemes();
  if(!metaData.settings.customThemes[idx]) metaData.settings.customThemes[idx]=defaultCustomThemes()[idx];
  metaData.settings.customThemes[idx][field]=value;
  saveToStorage(metaData);
  applyLobbyBackground(metaData.settings.lobbyTheme);
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme));
  playSound("click");
}
window.updateCustomThemeField=updateCustomThemeField;

// ---------------------------------------------------------------------
// Area drop-rate popup
// ---------------------------------------------------------------------
function toggleDropRatePopup(evt){
  evt.stopPropagation();
  const pop=document.getElementById("drop-rate-popup");
  if(pop.style.display==="block"){ pop.style.display="none"; return; }
  pop.innerHTML=AREAS.map((a,i)=>{
    const towerId=AREA_TOWER_UNLOCKS[i];
    const stat=TOWER_STATS[towerId];
    const owned=(metaData.unlockedAreaTowers||[]).includes(towerId);
    return `<div style="margin-bottom:6px;">
      <b style="color:${a.accent}">${a.name}</b> \u2192 ${stat?stat.name:"?"}
      ${owned?' <span style="color:var(--green)">(found)</span>':` <span style="color:#888">(${Math.round(AREA_TOWER_DROP_RATE*100)}% on clear)</span>`}
    </div>`;
  }).join("");
  pop.style.display="block";
  const btnRect=evt.currentTarget.getBoundingClientRect();
  const popW=pop.offsetWidth||260;
  const popH=pop.offsetHeight||160;
  let left=btnRect.left+btnRect.width/2-popW/2;
  left=Math.max(8,Math.min(left,window.innerWidth-popW-8));
  let top=btnRect.top-popH-10;
  if(top<8) top=btnRect.bottom+10;
  top=Math.max(8,Math.min(top,window.innerHeight-popH-8));
  pop.style.left=left+"px";
  pop.style.top=top+"px";
  playSound("click");
}
window.toggleDropRatePopup=toggleDropRatePopup;
document.addEventListener("click",e=>{
  const pop=document.getElementById("drop-rate-popup");
  if(pop && pop.style.display==="block" && !pop.contains(e.target)) pop.style.display="none";
});

// ---------------------------------------------------------------------
// Armory
// ---------------------------------------------------------------------
let armoryCollapseState={};
function renderArmory(){
  const list=document.getElementById("armory-list");
  list.innerHTML="";
  const slotsInfo=document.getElementById("armory-slots-info");
  slotsInfo.innerText=`Equip Slots: ${metaData.equippedTowers.length} / ${metaData.maxSlots} (max ${MAX_SLOTS_CLIENT})  \u00b7  Summoning Tickets: ${metaData.summonTickets||0}`;

  const groups={cheap:[],mid:[],expensive:[],areaLocked:[],summonOnly:[]};
  for(const id in TOWER_STATS){
    const s=TOWER_STATS[id];
    if(s.admin) continue;
    if(s.summonOnly) groups.summonOnly.push(id);
    else if(s.areaLocked) groups.areaLocked.push(id);
    else if(s.unlockCost<1000) groups.cheap.push(id);
    else if(s.unlockCost<2000) groups.mid.push(id);
    else groups.expensive.push(id);
  }

  function renderGroup(label,ids){
    if(ids.length===0) return;
    const h=document.createElement("div");
    h.className="armory-group-header";
    const groupKey="armory-collapse-"+label.replace(/\s+/g,"-");
    const isCollapsed=armoryCollapseState[groupKey];
    if(isCollapsed) h.classList.add("collapsed");
    h.innerHTML=`<span class="admin-cat-label" style="color:#9fd8a0;margin:0;">${label}</span><span class="agh-arrow" style="color:#9fd8a0;">&#9662;</span>`;
    const body=document.createElement("div");
    body.className="armory-group-body"+(isCollapsed?" collapsed":"");
    h.onclick=()=>{
      armoryCollapseState[groupKey]=!armoryCollapseState[groupKey];
      h.classList.toggle("collapsed");
      body.classList.toggle("collapsed");
      playSound("click");
    };
    list.appendChild(h);
    list.appendChild(body);
    ids.forEach(id=>{
      const stat=TOWER_STATS[id];
      const owned=metaData.ownedTowers.includes(id);
      const equipped=metaData.equippedTowers.includes(id);
      const isAreaLockedAndNotFound=stat.areaLocked && !(metaData.unlockedAreaTowers||[]).includes(id) && !owned;
      const card=document.createElement("div");
      card.className="armory-card"+(equipped?" equipped":"");
      if(isAreaLockedAndNotFound){
        card.style.filter="brightness(0.35) grayscale(0.6)";
        card.innerHTML=`
          <div class="a-info">
            <div class="a-name">&#128274; LOCKED</div>
            <div class="a-desc">Drops from clearing ${AREAS[stat.areaIndex].name} (${Math.round(AREA_TOWER_DROP_RATE*100)}% chance).</div>
          </div>`;
        body.appendChild(card);
        return;
      }
      let actionHtml;
      if(!owned && stat.summonOnly){
        card.style.filter="brightness(0.5) grayscale(0.4)";
        actionHtml=`<span style="font-family:Arial;font-size:.72rem;color:#888;">Summoning only</span>`;
      }else if(!owned){
        actionHtml=`<button class="armory-btn" onclick="armoryBuyTower('${id}')">BUY (${stat.unlockCost} Bio)</button>`;
      }else{
        actionHtml=`<button class="armory-btn${equipped?' unequip':''}" onclick="armoryToggleEquip('${id}')">${equipped?'UNEQUIP':'EQUIP'}</button>`;
      }
      card.innerHTML=`
        <div class="a-info">
          <div class="a-name" style="color:${stat.color}">${stat.name}</div>
          <div class="a-desc">${stat.desc}</div>
        </div>
        ${actionHtml}`;
      body.appendChild(card);
    });
  }
  renderGroup("Starter / Cheap",groups.cheap);
  renderGroup("Mid-Tier",groups.mid);
  renderGroup("Expensive",groups.expensive);
  renderGroup("Area-Unlock Towers",groups.areaLocked);
  renderGroup("Summon-Only Towers",groups.summonOnly);

  const slotRow=document.createElement("div");
  slotRow.className="armory-slot-row";
  if(metaData.maxSlots>=MAX_SLOTS_CLIENT){
    slotRow.innerHTML=`<span class="maxed">Max slots reached</span>`;
  }else{
    const nextCost=SLOT_COSTS_CLIENT[metaData.maxSlots+1];
    slotRow.innerHTML=`<button onclick="armoryBuySlot()">BUY SLOT (${nextCost} Bio)</button>`;
  }
  list.appendChild(slotRow);

  const mats=metaData.materials||{};
  const matLine=document.createElement("div");
  matLine.style.cssText="font-family:Arial;font-size:.78rem;color:#9fd8a0;text-align:center;margin-top:14px;";
  matLine.innerHTML="Materials: "+MATERIAL_TIERS.map(m=>`<span style="color:${MATERIAL_COLOR[m]}">${mats[m]||0} ${MATERIAL_NAME[m]}</span>`).join(" &middot; ");
  list.appendChild(matLine);

  const invNote=document.createElement("div");
  invNote.style.cssText="font-family:Arial;font-size:.75rem;color:#888;text-align:center;margin-top:10px;";
  invNote.innerText="Equip cards & armor onto specific towers, and repair broken gear, from the INVENTORY page.";
  list.appendChild(invNote);
}

function armoryBuyTower(id){
  apiPost("buyTower", { towerId: id }).then(res=>{
    if(res && res.data) migrateMetaData(res.data);
    if(res && res.success) playSound("build");
    else{ playSound("denied"); showAlertModal((res && res.message) || "Purchase failed."); }
    renderArmory();
  });
}
function armoryToggleEquip(id){
  const equipped=metaData.equippedTowers.includes(id);
  let newList;
  if(equipped) newList=metaData.equippedTowers.filter(t=>t!==id);
  else{
    if(metaData.equippedTowers.length>=metaData.maxSlots){ playSound("denied"); showAlertModal("No free slots - unequip a tower first, or buy another slot."); return; }
    newList=[...metaData.equippedTowers,id];
  }
  if(newList.length===0){ playSound("denied"); showAlertModal("You must keep at least one tower equipped."); return; }
  apiPost("setEquippedTowers", { towerIds: newList }).then(res=>{
    if(res && res.data) migrateMetaData(res.data);
    if(res && res.success) playSound("click");
    else{ playSound("denied"); showAlertModal((res && res.message) || "Could not update loadout."); }
    renderArmory();
  });
}
function armoryBuySlot(){
  apiPost("buySlot").then(res=>{
    if(res && res.data) migrateMetaData(res.data);
    if(res && res.success) playSound("build");
    else{ playSound("denied"); showAlertModal((res && res.message) || "Purchase failed."); }
    renderArmory();
  });
}
window.armoryBuyTower=armoryBuyTower;
window.armoryToggleEquip=armoryToggleEquip;
window.armoryBuySlot=armoryBuySlot;
