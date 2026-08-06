// =======================================================================
// SUMMONING PAGE LOGIC
// =======================================================================
function craftCards(powerupId,level){
  metaData.cardInstances=metaData.cardInstances||[];
  const def=POWERUP_DEFS.find(p=>p.id===powerupId);
  if(!def || def.rarity==="godly") return {success:false,message:"Godly cards cannot be crafted."};
  if(level>=3) return {success:false,message:"Already max level."};
  const candidates=metaData.cardInstances.filter(c=>c.defId===powerupId && c.level===level && c.durability===c.maxDurability);
  if(candidates.length<2) return {success:false,message:"Need 2 undamaged copies of level "+level+" to fuse."};
  return {success:false,message:"Use the Crafting page to fuse cards."};
}

function openCrate(crateIdx){
  const crate=CRATES[crateIdx];
  if(!crate) return {success:false,message:"Unknown crate."};
  if((metaData.summonTickets||0)<crate.cost) return {success:false,message:"Not enough Summoning Tickets."};
  metaData.summonTickets-=crate.cost;
  const rarity=rollRarity(crate.odds);
  const pool=POWERUP_DEFS.filter(p=>p.rarity===rarity);
  const won=pool[Math.floor(Math.random()*pool.length)] || POWERUP_DEFS[0];
  metaData.cardInstances=metaData.cardInstances||[];
  metaData.cardInstances.push(newCardInstance(won.id,1));
  saveToStorage(metaData);
  return {success:true,won,rarity};
}
function openArmorCrate(idx){
  const crate=ARMOR_CRATES[idx];
  if(!crate) return {success:false,message:"Unknown crate."};
  if((metaData.summonTickets||0)<crate.cost) return {success:false,message:"Not enough Summoning Tickets."};
  metaData.summonTickets-=crate.cost;
  const rarity=rollRarity(crate.odds);
  const pool=ARMOR_DEFS.filter(a=>a.rarity===rarity);
  const won=pool[Math.floor(Math.random()*pool.length)] || ARMOR_DEFS[0];
  metaData.armorInstances=metaData.armorInstances||[];
  metaData.armorInstances.push(newArmorInstance(won.id,1));
  metaData.stats.armorCratesOpened=(metaData.stats.armorCratesOpened||0)+1;
  saveToStorage(metaData);
  return {success:true,won,rarity};
}
function summonTower(){
  if((metaData.summonTickets||0)<TOWER_CRATE.cost) return {success:false,message:"Not enough Summoning Tickets."};
  const remaining=SUMMON_TOWER_IDS.filter(id=>!(metaData.ownedSummonTowers||[]).includes(id));
  if(remaining.length===0) return {success:false,message:"You already own every summon-only tower!"};
  metaData.summonTickets-=TOWER_CRATE.cost;
  const wonId=remaining[Math.floor(Math.random()*remaining.length)];
  metaData.ownedSummonTowers=metaData.ownedSummonTowers||[];
  metaData.ownedSummonTowers.push(wonId);
  metaData.ownedTowers=metaData.ownedTowers||[];
  if(!metaData.ownedTowers.includes(wonId)) metaData.ownedTowers.push(wonId);
  metaData.stats.towerCratesOpened=(metaData.stats.towerCratesOpened||0)+1;
  saveToStorage(metaData);
  return {success:true,wonId};
}

let summonSection="hub";
function renderSummoningHub(){
  summonSection="hub";
  document.getElementById("summoning-content").innerHTML=`
    <div style="font-family:Arial;color:#ccc;margin-bottom:16px;">Summoning Tickets: <b style="color:var(--gold)">${metaData.summonTickets||0}</b><br>
    Earned by clearing areas (Area 1 clear = 1 ticket, Area 2 = 2, etc).</div>
    <div class="summon-section-grid">
      <div class="summon-section-card" style="border-color:#ff6a2b;" onclick="openSummoningSection('cards')">
        <div class="ssc-icon">&#127183;</div>
        <div class="ssc-title" style="color:#ff6a2b;">CARDS</div>
      </div>
      <div class="summon-section-card" style="border-color:var(--purple);" onclick="openSummoningSection('armor')">
        <div class="ssc-icon">&#128737;&#65039;</div>
        <div class="ssc-title" style="color:var(--purple);">ARMOR</div>
      </div>
      <div class="summon-section-card" style="border-color:var(--cyan);" onclick="openSummoningSection('towers')">
        <div class="ssc-icon">&#128126;</div>
        <div class="ssc-title" style="color:var(--cyan);">TOWERS</div>
      </div>
    </div>`;
}
window.renderSummoningHub=renderSummoningHub;

function openSummoningSection(section){
  summonSection=section;
  if(section==="cards") renderCardsSection();
  else if(section==="armor") renderArmorSection();
  else if(section==="towers") renderTowersSection();
}
window.openSummoningSection=openSummoningSection;

function summonBackButton(){ return `<button class="summon-back-btn" onclick="renderSummoningHub()">&#8592; BACK</button>`; }

function renderCardsSection(){
  document.getElementById("summoning-content").innerHTML=`
    ${summonBackButton()}
    <div style="height:8px;"></div>
    ${CRATES.map((c,i)=>`
      <div style="border:2px solid #ff6a2b55;border-radius:12px;padding:14px;margin-bottom:12px;text-align:left;overflow-wrap:break-word;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
          <span style="flex:1 1 140px;min-width:0;"><b style="color:#ff6a2b;">${c.name}</b> \u2014 ${c.cost} tickets</span>
          <button class="crate-odds-toggle" style="flex:0 0 auto;" onclick="toggleCrateOdds(${i},event)">ODDS &#9662;</button>
          <button style="flex:0 0 auto;padding:.4em .8em;font-size:.75rem;min-height:32px;white-space:nowrap;" onclick="doOpenCrateBulk(${i},10)">OPEN x10 (${c.cost*10})</button>
          <button style="flex:0 0 auto;padding:.4em 1em;font-size:.8rem;min-height:32px;" onclick="doOpenCrateBulk(${i},1)">OPEN</button>
        </div>
        <div class="crate-odds-popup" id="crate-odds-${i}">
          ${RARITY_ORDER.map(r=>`<div>${r==="godly"?"GODLY":r.toUpperCase()}: ${r==="godly"?"???":(c.odds[r]||0)+"%"}</div>`).join("")}
        </div>
      </div>`).join("")}
    <button style="width:100%;margin-top:10px;border-color:#ff00ff;color:#ff00ff;" onclick="spinSecretTurret()">SECRET TURRET SPIN (0.1% chance) \u2014 25 tickets</button>`;
}

function renderArmorSection(){
  document.getElementById("summoning-content").innerHTML=`
    ${summonBackButton()}
    <div style="height:8px;"></div>
    ${ARMOR_CRATES.map((c,i)=>`
      <div style="border:2px solid var(--purple);border-radius:12px;padding:14px;margin-bottom:12px;text-align:left;overflow-wrap:break-word;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
          <span style="flex:1 1 140px;min-width:0;"><b style="color:var(--purple);">${c.name}</b> \u2014 ${c.cost} tickets</span>
          <button class="crate-odds-toggle" style="flex:0 0 auto;" onclick="toggleArmorCrateOdds(${i},event)">ODDS &#9662;</button>
          <button style="flex:0 0 auto;padding:.4em 1em;font-size:.8rem;min-height:32px;" onclick="doOpenArmorCrate(${i})">OPEN</button>
        </div>
        <div class="crate-odds-popup" id="armor-crate-odds-${i}">
          ${RARITY_ORDER.map(r=>`<div>${r==="godly"?"GODLY":r.toUpperCase()}: ${r==="godly"?"???":(c.odds[r]||0)+"%"}</div>`).join("")}
        </div>
      </div>`).join("")}
    <div style="font-family:Arial;font-size:.78rem;color:#888;">Fusing duplicate armor into higher levels happens on the CRAFTING page. Equipping repaired/fused armor onto towers happens on the INVENTORY page.</div>`;
}

function renderTowersSection(){
  const remaining=SUMMON_TOWER_IDS.filter(id=>!(metaData.ownedSummonTowers||[]).includes(id));
  document.getElementById("summoning-content").innerHTML=`
    ${summonBackButton()}
    <div style="height:8px;"></div>
    <div style="font-family:Arial;color:#ccc;margin-bottom:14px;text-align:left;">Summon a random tower from the pool below for ${TOWER_CRATE.cost} tickets. These towers cannot be fused or leveled through summoning - only 1 of each exists.</div>
    <div style="text-align:left;margin-bottom:14px;" id="summon-tower-list"></div>
    <button style="width:100%;" onclick="doSummonTower()" ${remaining.length===0?"disabled":""}>${remaining.length===0?"ALL TOWERS OWNED":"SUMMON TOWER ("+TOWER_CRATE.cost+" tickets)"}</button>`;
  const listEl=document.getElementById("summon-tower-list");
  SUMMON_TOWER_IDS.forEach(id=>{
    const stat=TOWER_STATS[id];
    const owned=(metaData.ownedSummonTowers||[]).includes(id);
    const row=document.createElement("div");
    row.style.cssText="display:flex;align-items:center;padding:6px 0;border-bottom:1px solid #222;gap:10px;";
    row.innerHTML=`
      <canvas class="beast-icon-canvas" width="34" height="34" style="flex:0 0 34px;"></canvas>
      <span style="flex:1;color:${owned?stat.color:'#666'};">${owned?stat.name:'???'}</span>
      <span style="color:${owned?'var(--green)':'#888'};font-size:.75rem;">${owned?'OWNED':'LOCKED'}</span>`;
    renderAlienIcon(row.querySelector("canvas"),"normal",{color:owned?stat.color:"#444",size:11});
    listEl.appendChild(row);
  });
}

function toggleCrateOdds(i,evt){
  if(evt) evt.stopPropagation();
  const el=document.getElementById("crate-odds-"+i);
  if(el) el.style.display=(el.style.display==="block")?"none":"block";
}
window.toggleCrateOdds=toggleCrateOdds;
function toggleArmorCrateOdds(i,evt){
  if(evt) evt.stopPropagation();
  const el=document.getElementById("armor-crate-odds-"+i);
  if(el) el.style.display=(el.style.display==="block")?"none":"block";
}
window.toggleArmorCrateOdds=toggleArmorCrateOdds;

function summonReturnFooter(backFn){
  const auto=!!(metaData.settings && metaData.settings.autoReturnSummon);
  if(auto){
    setTimeout(()=>{ if(document.getElementById("summoning-content")){ backFn(); } },1700);
    return `<div style="margin-top:10px;font-family:Arial;font-size:.75rem;color:#888;">Auto-returning...</div>`;
  }
  window.__summonReturnFn=()=>{ backFn(); };
  return `<button style="width:100%;margin-top:14px;" onclick="window.__summonReturnFn && window.__summonReturnFn()">RETURN</button>`;
}

function doOpenCrateBulk(idx,count){
  const crate=CRATES[idx];
  if(!crate) return;
  if((metaData.summonTickets||0)<crate.cost){ playSound("denied"); showAlertModal("Not enough Summoning Tickets."); return; }
  AudioEngine.playMusic(crate.music||"crate1");
  if(count===1){
    const res=openCrate(idx);
    if(!res.success){ playSound("denied"); showAlertModal(res.message||"Could not open crate."); return; }
    metaData.stats.cratesOpened=(metaData.stats.cratesOpened||0)+1;
    questNotifyProgress("crate",1);
    playSound("crateSpin");
    showCrateWheel(res);
    return;
  }
  const results=[];
  for(let i=0;i<count;i++){
    if((metaData.summonTickets||0)<crate.cost) break;
    const res=openCrate(idx);
    if(!res.success) break;
    metaData.stats.cratesOpened=(metaData.stats.cratesOpened||0)+1;
    questNotifyProgress("crate",1);
    results.push(res);
  }
  playSound("crateSpin");
  const tally={};
  let bestRarity="common";
  for(const r of results){
    if(!tally[r.won.id]) tally[r.won.id]={def:r.won,count:0,rarity:r.rarity};
    tally[r.won.id].count++;
    if(RARITY_ORDER.indexOf(r.rarity)>RARITY_ORDER.indexOf(tally[r.won.id].rarity)) tally[r.won.id].rarity=r.rarity;
    if(RARITY_ORDER.indexOf(r.rarity)>RARITY_ORDER.indexOf(bestRarity)) bestRarity=r.rarity;
  }
  const items=Object.values(tally);
  setTimeout(()=>{
    const rarSfx = bestRarity==="godly" ? "winGodly" : (RARITY_ORDER.indexOf(bestRarity)>=3 ? "winRare" : "winCommon");
    playSound(rarSfx);
    document.getElementById("summoning-content").innerHTML=`
      <div class="crate-reveal">
        <div class="crate-reveal-title">${results.length>1?results.length+" CRATES OPENED":"CRATE OPENED"}</div>
        ${items.map((it,i)=>`
          <div class="crate-reveal-item" style="--rc:${RARITY_COLOR[it.rarity]};animation-delay:${i*0.12}s">
            <b style="color:${RARITY_COLOR[it.rarity]}">${it.def.name}</b>
            <span style="color:${RARITY_COLOR[it.rarity]};font-size:.75rem;">${it.rarity==="godly"?"???":it.rarity.toUpperCase()}</span>
            ${it.count>1?` x${it.count}`:""}
            <div style="font-family:Arial;font-size:.78rem;color:#ccc;margin-top:3px;">${powerupDescForLevel(it.def,1)} (Durability 1/1 each)</div>
          </div>`).join("")}
        ${summonReturnFooter(renderCardsSection)}
      </div>`;
  },350);
}
window.doOpenCrateBulk=doOpenCrateBulk;

function showCrateWheel(res){
  const segAngle=360/RARITY_ORDER.length;
  const idx=Math.max(0,RARITY_ORDER.indexOf(res.rarity));
  const gradientStops=RARITY_ORDER.map((r,i)=>`${RARITY_COLOR[r]} ${i*segAngle}deg ${(i+1)*segAngle}deg`).join(",");
  document.getElementById("summoning-content").innerHTML=`
    <div class="crate-reveal">
      <div class="crate-reveal-title">SPINNING...</div>
      <div class="wheel-wrap">
        <div class="wheel-pointer"></div>
        <div class="wheel-disc" id="crate-wheel-disc" style="background:conic-gradient(${gradientStops});"></div>
        <div class="wheel-hub"></div>
      </div>
      <div class="wheel-legend">
        ${RARITY_ORDER.map(r=>`<span style="color:${RARITY_COLOR[r]}">&#9679; ${r==="godly"?"???":r}</span>`).join(" &nbsp; ")}
      </div>
    </div>`;
  const disc=document.getElementById("crate-wheel-disc");
  const extraSpins=5;
  const finalRotation=extraSpins*360+((360-(idx*segAngle+segAngle/2))%360);
  disc.style.transform="rotate(0deg)";
  void disc.offsetWidth;
  requestAnimationFrame(()=>{ disc.style.transform=`rotate(${finalRotation}deg)`; });
  const onDone=()=>{
    disc.removeEventListener("transitionend",onDone);
    const rarSfx = res.rarity==="godly" ? "winGodly" : (idx>=3 ? "winRare" : "winCommon");
    playSound(rarSfx);
    document.getElementById("summoning-content").innerHTML=`
      <div class="crate-reveal">
        <div class="crate-reveal-title">CRATE OPENED</div>
        <div class="crate-reveal-item" style="--rc:${RARITY_COLOR[res.rarity]}">
          <b style="color:${RARITY_COLOR[res.rarity]}">${res.won.name}</b>
          <span style="color:${RARITY_COLOR[res.rarity]};font-size:.75rem;">${res.rarity==="godly"?"???":res.rarity.toUpperCase()}</span>
          <div style="font-family:Arial;font-size:.78rem;color:#ccc;margin-top:3px;">${powerupDescForLevel(res.won,1)} (Durability 1/1)</div>
        </div>
        ${summonReturnFooter(renderCardsSection)}
      </div>`;
  };
  disc.addEventListener("transitionend",onDone);
}
window.showCrateWheel=showCrateWheel;

function doOpenArmorCrate(idx){
  const crate=ARMOR_CRATES[idx];
  if(!crate) return;
  const res=openArmorCrate(idx);
  if(!res.success){ playSound("denied"); showAlertModal(res.message||"Could not open crate."); return; }
  AudioEngine.playMusic(crate.music||"crate1");
  playSound(res.rarity==="godly"?"winGodly":(RARITY_ORDER.indexOf(res.rarity)>=3?"winRare":"winCommon"));
  document.getElementById("summoning-content").innerHTML=`
    <div class="crate-reveal">
      <div class="crate-reveal-title">ARMOR CRATE OPENED</div>
      <div class="crate-reveal-item" style="--rc:${RARITY_COLOR[res.rarity]}">
        <b style="color:${RARITY_COLOR[res.rarity]}">${res.won.name}</b>
        <span style="color:${RARITY_COLOR[res.rarity]};font-size:.75rem;">${res.rarity==="godly"?"???":res.rarity.toUpperCase()}</span>
        <div style="font-family:Arial;font-size:.78rem;color:#ccc;margin-top:3px;">${armorDescForLevel(res.won,1)} (Durability 1/1)</div>
      </div>
      ${summonReturnFooter(renderArmorSection)}
    </div>`;
}
window.doOpenArmorCrate=doOpenArmorCrate;

function doSummonTower(){
  const res=summonTower();
  if(!res.success){ playSound("denied"); showAlertModal(res.message||"Could not summon a tower."); return; }
  const stat=TOWER_STATS[res.wonId];
  playSound("winGodly");
  document.getElementById("summoning-content").innerHTML=`
    <div class="crate-reveal">
      <div class="crate-reveal-title">TOWER SUMMONED</div>
      <div class="crate-reveal-item" style="--rc:${stat.color}">
        <b style="color:${stat.color}">${stat.name}</b>
        <div style="font-family:Arial;font-size:.78rem;color:#ccc;margin-top:3px;">${stat.desc}</div>
      </div>
      ${summonReturnFooter(renderTowersSection)}
    </div>`;
}
window.doSummonTower=doSummonTower;

function spinSecretTurret(){
  if((metaData.summonTickets||0)<25){ playSound("denied"); showAlertModal("Not enough tickets (need 25)."); return; }
  metaData.summonTickets-=25;
  saveToStorage(metaData);
  playSound("crateSpin");
  setTimeout(()=>{
    if(Math.random()<0.001){
      metaData.ownedTowers.push("secretop");
      saveToStorage(metaData);
      playSound("winGodly");
      showAlertModal("JACKPOT! You unlocked the secret VOIDBRINGER turret!");
    }else{
      playSound("denied");
      showAlertModal("No luck this time. (0.1% chance)");
    }
  },400);
}
window.spinSecretTurret=spinSecretTurret;

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  renderSummoningHub();
});
