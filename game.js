// =======================================================================
// GAME PAGE LOGIC — the actual tower-defense engine. Loaded after
// shared/data.js, storage.js, audio.js, ui.js, settings.js, icons.js,
// quests.js, admin-meta.js.
// =======================================================================
let currentMode=sessionStorage.getItem("atd_selectedMode")||"normal";
let localCoopMode=sessionStorage.getItem("atd_localCoop")==="1";

function getAreaIndex(){
  const w=Math.max(1,wave);
  return Math.min(AREAS.length-1, Math.floor((w-1)/10));
}
function getCurrentArea(){ return AREAS[getAreaIndex()]; }

// ---------------------------------------------------------------------
// CANVAS / STAGE
// ---------------------------------------------------------------------
const canvas=document.getElementById("gameCanvas");
let ctx=canvas.getContext("2d");
const BASE_W=1920, BASE_H=1080;
let displayScale=1;

function resize(){
  if(canvas.width!==BASE_W || canvas.height!==BASE_H){ canvas.width=BASE_W; canvas.height=BASE_H; }
  const scale=Math.min(innerWidth/BASE_W, innerHeight/BASE_H);
  displayScale=scale;
  const dispW=BASE_W*scale, dispH=BASE_H*scale;
  canvas.style.width=dispW+"px"; canvas.style.height=dispH+"px";
  const stage=document.getElementById("stage");
  if(stage){ stage.style.width=dispW+"px"; stage.style.height=dispH+"px"; }
  if(path.length===0) generatePath();
}
window.addEventListener("resize",resize);

function canvasPointFromClient(clientX,clientY){
  const rect=canvas.getBoundingClientRect();
  return { x:(clientX-rect.left)*(BASE_W/rect.width), y:(clientY-rect.top)*(BASE_H/rect.height) };
}
function getCanvasCoords(e){
  const point=(e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  return canvasPointFromClient(point.clientX,point.clientY);
}

let gameLoopId, isPlaying=false, isPaused=false, gold=0, lives=20, wave=0, killsThisGame=0;
let towers=[], enemies=[], projectiles=[], particles=[];
let discoveredTypes=new Set();
let path=[];
let enemiesLeft=0, spawnTimer=0;
let selectedShopItem=null, selectedTower=null;
let mousePos={x:0,y:0};
let lastDeathWave=0, lastDeathWasBoss=false, savedBossSnapshot=null;
let reviveUsedThisRun=false;
let godArmorOn=false, oneHitModeOn=false, tinyAliensOn=false, discoBallLocalOn=false;
let flossWallPlaced=false;
let flossWallPlacementCount=0;
function getFlossWallCost(){ return 100+flossWallPlacementCount*150; }
let moveModeTower=null;

canvas.addEventListener("mousemove",e=>{ const c=getCanvasCoords(e); mousePos.x=c.x; mousePos.y=c.y; });

function generatePath(){
  const cy=BASE_H/2;
  path=[
    {x:-50,y:cy},{x:BASE_W*.2,y:cy},{x:BASE_W*.2,y:cy-200},{x:BASE_W*.6,y:cy-200},
    {x:BASE_W*.6,y:cy+200},{x:BASE_W*.8,y:cy+200},{x:BASE_W*.8,y:cy},{x:BASE_W+50,y:cy}
  ];
}

const PLACEMENT_EDGE_MARGIN=30;
const MIN_PATH_CLEARANCE=55, MIN_TOWER_SPACING=52;

function isValidPlacement(x,y){
  if(x<PLACEMENT_EDGE_MARGIN || x>BASE_W-PLACEMENT_EDGE_MARGIN) return false;
  if(y<PLACEMENT_EDGE_MARGIN || y>BASE_H-PLACEMENT_EDGE_MARGIN) return false;
  for(let i=0;i<path.length-1;i++){ if(getDistToSegment({x,y},path[i],path[i+1])<MIN_PATH_CLEARANCE) return false; }
  for(const t of towers){ if(Math.hypot(t.x-x,t.y-y)<MIN_TOWER_SPACING) return false; }
  return true;
}
function getDistToSegment(p,v,w){
  const l2=(v.x-w.x)**2+(v.y-w.y)**2;
  if(l2===0) return Math.hypot(p.x-v.x,p.y-v.y);
  let t=Math.max(0,Math.min(1,((p.x-v.x)*(w.x-v.x)+(p.y-v.y)*(w.y-v.y))/l2));
  return Math.hypot(p.x-(v.x+t*(w.x-v.x)),p.y-(v.y+t*(w.y-v.y)));
}

function toggleShop(){
  const shop=document.getElementById("shop-panel");
  const openBtn=document.getElementById("shop-open-btn");
  const isHidden=shop.style.display==="none";
  shop.style.display=isHidden?"block":"none";
  openBtn.style.display=isHidden?"none":"block";
  playSound("click");
}
window.toggleShop=toggleShop;

function renderShopCards(){
  const container=document.getElementById("shop-cards");
  container.innerHTML="";
  const loadout=adminAllTowersUnlocked
    ? Object.keys(TOWER_STATS).filter(id=>!TOWER_STATS[id].admin)
    : ((metaData.equippedTowers && metaData.equippedTowers.length) ? metaData.equippedTowers : ["acid"]);
  const allIds=[...loadout];
  for(const id of allIds){
    const stat=TOWER_STATS[id];
    if(!stat) continue;
    if(stat.isWall && flossWallPlaced) continue;
    const card=document.createElement("div");
    card.className="tower-card";
    card.id="card-"+id;
    card.onclick=()=>selectShopItem(id);
    const eqCard=metaData.towerCardEquip?metaData.towerCardEquip[id]:null;
    const eqArmor=metaData.towerArmorEquip?metaData.towerArmorEquip[id]:null;
    let eqLine="";
    if(eqCard||eqArmor){
      const bits=[];
      if(eqCard){ const inst=(metaData.cardInstances||[]).find(c=>c.id===eqCard); const def=inst&&POWERUP_DEFS.find(p=>p.id===inst.defId); if(def) bits.push("Card: "+def.name+" ("+inst.durability+"/"+inst.maxDurability+")"); }
      if(eqArmor){ const inst=(metaData.armorInstances||[]).find(c=>c.id===eqArmor); const def=inst&&ARMOR_DEFS.find(a=>a.id===inst.defId); if(def) bits.push("Armor: "+def.name+" ("+inst.durability+"/"+inst.maxDurability+")"); }
      if(bits.length) eqLine=`<div style="font-family:Arial;font-size:.7rem;color:#9fd8a0;margin-top:5px;">${bits.join(" | ")}</div>`;
    }
    const displayCost=stat.isWall?getFlossWallCost():stat.cost;
    card.innerHTML=`<div class="t-name" style="color:${stat.color}">${stat.name}</div>
      <div class="t-desc">${stat.desc}</div><div class="t-cost">${displayCost} Cr</div>${eqLine}`;
    container.appendChild(card);
  }
}

let pendingPlacement=null, lastTapTime=0, lastTapPos={x:-999,y:-999};

function tryCollectGoldDrop(x,y){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    if(p.goldDrop && Math.hypot(p.x-x,p.y-y)<26){
      if(netRole==="client"){ netSendAction("collectGold",{x,y}); return true; }
      particles.splice(i,1);
      const bonus=10+Math.floor(Math.random()*21);
      gold+=bonus;
      particles.push({floatText:true,text:"+"+bonus,x,y,vy:-1.3,life:45,color:"#ffd700"});
      updateHUD();
      playSound("build");
      return true;
    }
  }
  return false;
}

function handlePointerDown(x,y,isTouch){
  if(isPlaying && tryCollectGoldDrop(x,y)) return;
  if(moveModeTower){
    const mt=moveModeTower;
    if(!(mt.id!=null ? towers.some(t=>t.id===mt.id) : towers.includes(mt))){ moveModeTower=null; }
    else if(Math.hypot(mt.x-x,mt.y-y)<25){
      moveModeTower=null;
    }else if(isValidPlacement(x,y)){
      moveTowerTo(mt,x,y);
      moveModeTower=null;
    }else{
      playSound("denied");
    }
    return;
  }
  if(selectedShopItem){
    const stat=TOWER_STATS[selectedShopItem];
    const effCost=stat.isWall?getFlossWallCost():stat.cost;
    if(selectedShopItem==="flosswall" && flossWallPlaced){ selectedShopItem=null; return; }
    if(isTouch){
      const now=performance.now();
      const closeEnough=Math.hypot(x-lastTapPos.x,y-lastTapPos.y)<40;
      if(pendingPlacement===selectedShopItem && closeEnough && (now-lastTapTime)<450){
        if(gold>=effCost && isValidPlacement(x,y)){
          requestBuildTower(x,y,selectedShopItem);
          selectedShopItem=null; pendingPlacement=null;
          document.querySelectorAll(".tower-card").forEach(c=>c.classList.remove("active"));
        }
      }else{
        pendingPlacement=selectedShopItem;
        mousePos.x=x; mousePos.y=y;
      }
      lastTapTime=now; lastTapPos={x,y};
      return;
    }
    if(gold>=effCost && isValidPlacement(x,y)){
      requestBuildTower(x,y,selectedShopItem);
      selectedShopItem=null;
      document.querySelectorAll(".tower-card").forEach(c=>c.classList.remove("active"));
    }
    return;
  }
  const prevSelected=selectedTower;
  selectedTower=null;
  document.getElementById("upgrade-panel").style.display="none";
  for(const t of towers){
    if(Math.hypot(t.x-x,t.y-y)<25){
      if(prevSelected && prevSelected!==t && prevSelected.isFlossling && t.isFlossling && prevSelected.parentType===t.parentType){
        fuseFlosslings(prevSelected,t);
        updateHUD();
        return;
      }
      selectedTower=t; updateUpgradePanel(); break;
    }
  }
}
canvas.addEventListener("mousedown",e=>{ const c=getCanvasCoords(e); mousePos.x=c.x; mousePos.y=c.y; handlePointerDown(c.x,c.y,false); });
canvas.addEventListener("touchstart",e=>{
  e.preventDefault();
  if(localCoopMode){
    for(const touch of e.changedTouches){
      const c=canvasPointFromClient(touch.clientX,touch.clientY);
      handlePointerDown(c.x,c.y,false);
    }
    return;
  }
  const c=getCanvasCoords(e); mousePos.x=c.x; mousePos.y=c.y; handlePointerDown(c.x,c.y,true);
},{passive:false});
canvas.addEventListener("touchmove",e=>{
  e.preventDefault();
  const c=getCanvasCoords(e); mousePos.x=c.x; mousePos.y=c.y;
  if(pendingPlacement) { lastTapPos={x:c.x,y:c.y}; }
},{passive:false});

function updateUpgradePanel(){
  if(!selectedTower) return;
  const t=selectedTower;
  const panel=document.getElementById("upgrade-panel");
  panel.style.display="block";
  document.getElementById("upg-title").innerText=t.name+(t.armored?" [ARMORED]":"");
  document.getElementById("upg-title").style.color=t.color;
  document.getElementById("upg-dmg").innerText=Math.floor(t.dmgDealt);
  document.getElementById("upg-lvl").innerText=t.level;
  const eqInfo=document.getElementById("upg-equip-info");
  if(eqInfo){
    const parts=[];
    if(t.equippedCardDefId){ const d=POWERUP_DEFS.find(p=>p.id===t.equippedCardDefId); if(d) parts.push("Card: "+d.name); }
    if(t.equippedArmorDefId){ const d=ARMOR_DEFS.find(a=>a.id===t.equippedArmorDefId); if(d) parts.push("Armor: "+d.name); }
    eqInfo.innerText=parts.length?parts.join(" | "):"";
  }
  const btnUpg=document.getElementById("btn-upg");
  const btnSell=document.getElementById("btn-sell");
  const btnFloss=document.getElementById("btn-floss");
  const btnMove=document.getElementById("btn-move");
  if(t.isWall){
    btnUpg.innerText="CANNOT UPGRADE"; btnUpg.disabled=true;
    btnSell.disabled=true; btnSell.innerText="PERMANENT";
    btnFloss.disabled=true;
    btnMove.disabled=true; btnMove.innerText="CANNOT MOVE";
    return;
  }
  btnSell.disabled=false; btnSell.innerText="SELL";
  if(t.isFlossling){
    btnFloss.disabled=true; btnFloss.innerText="TAP ANOTHER TO FUSE";
  }else{
    btnFloss.disabled=!!t.flossed; btnFloss.innerText="FLOSS";
  }
  const moveCost=getTowerMoveCost(t);
  if(moveCost===null){ btnMove.disabled=true; btnMove.innerText="CANNOT MOVE"; }
  else{ btnMove.disabled=(gold<moveCost); btnMove.innerText=`MOVE (${moveCost})`; }
  const upgCost=Math.floor(TOWER_STATS[t.type].cost*0.75*t.level);
  if(t.oneTime){ btnUpg.innerText=t.used?"CONSUMED":"ONE-TIME USE"; btnUpg.disabled=true; }
  else if(t.level>=3){ btnUpg.innerText="MAX LEVEL"; btnUpg.disabled=true; }
  else{ btnUpg.innerText=`UPGRADE (${upgCost})`; btnUpg.disabled=gold<upgCost; }
}

function getTowerMoveCost(t){
  const base=TOWER_STATS[t.type].cost;
  const mc=t.moveCount||0;
  if(mc===0) return Math.floor(base*0.25);
  if(mc===1) return Math.floor(base*0.5);
  return null;
}
function moveTowerTo(t,x,y){
  if(netRole==="client"){ netSendAction("moveTower",{id:t.id,x,y}); return; }
  const cost=getTowerMoveCost(t);
  if(cost===null || gold<cost){ playSound("denied"); return; }
  gold-=cost;
  t.x=x; t.y=y;
  t.moveCount=(t.moveCount||0)+1;
  playSound("build");
  updateHUD();
  if(selectedTower===t) updateUpgradePanel();
}
function moveSelectedTower(){
  if(!selectedTower || selectedTower.isWall) return;
  const cost=getTowerMoveCost(selectedTower);
  if(cost===null){ playSound("denied"); return; }
  if(gold<cost){ playSound("denied"); return; }
  moveModeTower=selectedTower;
  playSound("click");
}
window.moveSelectedTower=moveSelectedTower;

function upgradeTower(target){
  const t=target||selectedTower;
  if(!t || t.oneTime || t.level>=3 || t.isWall) return;
  if(netRole==="client"){ netSendAction("upgradeTower",{id:t.id}); return; }
  const cost=Math.floor(TOWER_STATS[t.type].cost*0.75*t.level);
  if(gold>=cost){
    gold-=cost; t.level++;
    t.range*=1.2; t.damage*=1.4;
    playSound("upgrade"); updateHUD(); updateUpgradePanel();
  }
}
function sellTower(target){
  const t=target||selectedTower;
  if(!t || t.isWall) return;
  if(netRole==="client"){
    netSendAction("sellTower",{id:t.id});
    if(selectedTower===t){ selectedTower=null; document.getElementById("upgrade-panel").style.display="none"; }
    return;
  }
  const baseVal=TOWER_STATS[t.type].cost;
  gold+=Math.floor((baseVal+(baseVal*0.75*(t.level-1)))*0.5);
  towers=towers.filter(x=>x!==t);
  if(selectedTower===t) selectedTower=null;
  document.getElementById("upgrade-panel").style.display="none";
  playSound("sell"); updateHUD(); renderShopCards();
}
window.upgradeTower=upgradeTower; window.sellTower=sellTower;

function flossTower(t){
  if(t.isWall || t.isFlossling || t.flossed) return;
  if(netRole==="client"){ netSendAction("flossTower",{id:t.id}); return; }
  const idx=towers.indexOf(t);
  if(idx===-1) return;
  towers.splice(idx,1);
  for(let i=0;i<2;i++){
    towers.push({
      id:nextTowerId(),
      x:t.x+(i===0?-20:20), y:t.y+10, type:t.type, name:t.name+" (Towerling)",
      range:t.range*0.5, damage:t.damage*0.5, fireRate:t.fireRate, color:t.color,
      cooldown:0, level:t.level, dmgDealt:0, angle:0, stunTimer:0, target:null,
      oneTime:t.oneTime, used:false, isFlossling:true, parentType:t.type, armored:t.armored,
      critChance:t.critChance||0, splashBonusPct:t.splashBonusPct||0, goldBonusPct:t.goldBonusPct||0,
      bossDmgBonusPct:t.bossDmgBonusPct||0, armoredDmgBonusPct:t.armoredDmgBonusPct||0, stunResistPct:t.stunResistPct||0
    });
  }
  playSound("sell");
}
function fuseFlosslings(a,b){
  if(!a.isFlossling || !b.isFlossling || a.parentType!==b.parentType) return;
  if(netRole==="client"){ netSendAction("fuseFloss",{aId:a.id,bId:b.id}); return; }
  towers=towers.filter(x=>x!==a && x!==b);
  const s=TOWER_STATS[a.parentType];
  towers.push({
    id:nextTowerId(),
    x:(a.x+b.x)/2, y:(a.y+b.y)/2, type:a.parentType, name:s.name,
    range:s.range, damage:s.damage, fireRate:s.fireRate, color:s.color,
    cooldown:0, level:1, dmgDealt:0, angle:0, stunTimer:0, target:null,
    oneTime:!!s.oneTime, used:false, armored:(a.armored||b.armored),
    critChance:0, splashBonusPct:0, goldBonusPct:0, bossDmgBonusPct:0, armoredDmgBonusPct:0, stunResistPct:0
  });
  playSound("build");
}
window.flossTower=flossTower;

function getWaveMultiplier(){
  const tier=Math.floor((Math.max(1,wave)-1)/5);
  const mode=MODES[currentMode]||MODES.normal;
  return { hp:(1+tier*0.22)*mode.hpMul, speed:(1+tier*0.05)*mode.speedMul };
}
function freezeForDiscovery(type){
  gameFreeze=true;
  const base=ENEMY_TYPES[type]||{};
  const nameEl=document.getElementById("discovery-name");
  nameEl.innerText=base.name||type;
  nameEl.style.color=base.color||"#fff";
  document.getElementById("discovery-desc").innerText=BEAST_DESC[type]||"";
  renderAlienIcon(document.getElementById("discovery-canvas"),type,{color:base.color,size:46});
  const overlay=document.getElementById("discovery-overlay");
  overlay.style.color=base.color||"#39ff14";
  overlay.style.display="flex";
  playSound("typeReveal");
  setTimeout(()=>{
    overlay.style.display="none";
    resumeLoopAfterFreeze();
  },2200);
}

function showBossWarningBanner(){
  const banner=document.getElementById("boss-warning-banner");
  banner.innerText="\u26A0 BOSS INCOMING NEXT WAVE \u26A0";
  banner.classList.add("show");
  playSound("bossIncoming");
  setTimeout(()=>{ banner.classList.remove("show"); },3200);
}

function freezeForBossIntro(bossName,color,theme){
  gameFreeze=true;
  const label=document.getElementById("boss-intro-label");
  label.innerText="WARNING";
  const nameEl=document.getElementById("boss-intro-name");
  nameEl.innerText=bossName;
  nameEl.style.color=color;
  renderAlienIcon(document.getElementById("boss-intro-canvas"),"boss",{color,theme,size:52});
  const overlay=document.getElementById("boss-intro-overlay");
  const inner=overlay.querySelector(".boss-intro-inner");
  overlay.style.color=color;
  inner.classList.remove("flashy-mode","retro-mode");
  label.classList.remove("flashy-mode","retro-mode");
  overlay.classList.remove("flash-mode");
  void inner.offsetWidth;
  if(flashyMode){
    inner.classList.add("flashy-mode");
    label.classList.add("flashy-mode");
    overlay.classList.add("flash-mode");
  }else{
    inner.classList.add("retro-mode");
    label.classList.add("retro-mode");
  }
  overlay.style.display="flex";
  setTimeout(()=>{
    overlay.style.display="none";
    overlay.classList.remove("flash-mode");
    resumeLoopAfterFreeze();
  },2600);
}

function spawnBoss(){
  const areaIndex=getAreaIndex();
  const areaBoss=AREAS[areaIndex].boss;
  const mul=getWaveMultiplier();
  const hp=Math.floor(ENEMY_TYPES.boss.hp*(1+wave*0.08)*(1+areaIndex*0.15)*mul.hp);
  enemies.push({
    type:"boss",name:areaBoss.name,x:path[0].x,y:path[0].y,hp,maxHp:hp,
    speed:ENEMY_TYPES.boss.speed*mul.speed, baseSpeed:ENEMY_TYPES.boss.speed*mul.speed,
    size:ENEMY_TYPES.boss.size, reward:ENEMY_TYPES.boss.reward+wave*8, color:areaBoss.color,
    segment:0, distWalked:0, slowTimer:0, stunCooldown:60, stunRadius:ENEMY_TYPES.boss.stunRadius,
    stunDuration:ENEMY_TYPES.boss.stunDuration, stunInterval:ENEMY_TYPES.boss.stunInterval, stunned:0,
    isBoss:true, areaIndex, isFinalBoss:(areaIndex===AREAS.length-1)
  });
  playSound("bossSpawn");
  recordDiscovery("boss",areaIndex);
  freezeForBossIntro(areaBoss.name,areaBoss.color,AREAS[areaIndex].theme);
}

function callNextWave(){
  if(enemiesLeft>0 || enemies.length>0) return;
  wave++;
  enemiesLeft=5+(wave*3);
  spawnTimer=0;
  if(wave%10===0) spawnBoss(); else playSound("waveStart");
  if(wave%10===9) showBossWarningBanner();
  questNotifyProgress("wave",wave);
  updateHUD();
}
window.callNextWave=callNextWave;

function pickEnemyType(){
  const idx=getAreaIndex();
  const trio=AREA_EXCLUSIVE_TYPES[idx];
  if(Math.random()<0.001) return "impostor";
  if(trio && Math.random()<0.3) return trio[Math.floor(Math.random()*trio.length)];
  return pickGenericEnemyType();
}
function pickGenericEnemyType(){
  if(wave>=50){ const r=Math.random();
    if(r<0.14) return "juggernaut"; if(r<0.30) return "cloaked"; if(r<0.46) return "splitter";
    if(r<0.62) return "shielded"; if(r<0.78) return "tank"; if(r<0.90) return "stunner"; return "runner"; }
  if(wave>=30){ const r=Math.random();
    if(r<0.14) return "shielded"; if(r<0.28) return "cloaked"; if(r<0.42) return "splitter";
    if(r<0.60) return "tank"; if(r<0.78) return "stunner"; if(r<0.90) return "runner"; return "normal"; }
  if(wave>=15){ const r=Math.random();
    if(r<0.10) return "shielded"; if(r<0.20) return "splitter"; if(r<0.30) return "runner";
    if(r<0.55) return "stunner"; if(r<0.75) return "tank"; return "normal"; }
  if(wave>=10){ const r=Math.random(); if(r<0.45) return "normal"; if(r<0.70) return "runner"; return "stunner"; }
  if(wave>=5){ return Math.random()<0.55 ? "normal" : "runner"; }
  return "normal";
}

function rollMaterialDrop(){
  const tier=Math.min(4,Math.floor((Math.max(1,wave)-1)/12));
  const r=Math.random();
  let mat="common";
  if(tier>=4){ if(r<0.05) mat="legendary"; else if(r<0.2) mat="epic"; else if(r<0.45) mat="rare"; else if(r<0.75) mat="uncommon"; else mat="common"; }
  else if(tier>=3){ if(r<0.02) mat="legendary"; else if(r<0.12) mat="epic"; else if(r<0.35) mat="rare"; else if(r<0.65) mat="uncommon"; else mat="common"; }
  else if(tier>=2){ if(r<0.05) mat="epic"; else if(r<0.2) mat="rare"; else if(r<0.5) mat="uncommon"; else mat="common"; }
  else if(tier>=1){ if(r<0.08) mat="rare"; else if(r<0.35) mat="uncommon"; else mat="common"; }
  else{ mat=(r<0.2)?"uncommon":"common"; }
  return mat;
}

function spawnEnemy(){
  if(enemiesLeft<=0) return;
  enemiesLeft--;
  const type=pickEnemyType();
  const base=ENEMY_TYPES[type];
  const mul=getWaveMultiplier();
  const hp=Math.max(1,Math.floor(base.hp*(1+wave*0.16)*mul.hp));
  enemies.push({
    type,x:path[0].x,y:path[0].y,hp,maxHp:hp,speed:base.speed*mul.speed,baseSpeed:base.speed*mul.speed,
    size:tinyAliensOn?base.size*0.4:base.size,reward:base.reward+Math.floor(wave*0.4),color:base.color,segment:0,distWalked:0,
    slowTimer:0,stunCooldown:base.stunInterval||0,stunInterval:base.stunInterval||0,
    stunRadius:base.stunRadius||0,stunDuration:base.stunDuration||0,stunned:0,
    cloakTimer:base.cloakInterval||0,cloaked:false,bobSeed:Math.random()*1000
  });
  if(!discoveredTypes.has(type)) discoveredTypes.add(type);
  const isNewDiscovery=recordDiscovery("type",type);
  if(isNewDiscovery) freezeForDiscovery(type);
}

function killEnemy(e,sourceTower){
  const index=enemies.indexOf(e);
  if(index===-1) return;
  let reward=e.reward;
  if(sourceTower && sourceTower.goldBonusPct) reward=Math.round(reward*(1+sourceTower.goldBonusPct/100));
  gold+=reward; killsThisGame++;
  enemies.splice(index,1);
  playSound("enemyDeath");
  metaData.stats=metaData.stats||{};
  metaData.stats.totalKills=(metaData.stats.totalKills||0)+1;
  questNotifyProgress("kill",1);
  questNotifyProgress("credits",reward);
  if(Math.random()<0.05){
    particles.push({goldDrop:true,x:e.x,y:e.y,collected:false,life:600,size:8});
  }
  if(Math.random()<0.08){
    const mat=rollMaterialDrop();
    grantMaterial(mat,1);
    particles.push({materialDrop:true,mat,x:e.x,y:e.y,life:600,size:8});
  }
  const parentBase=ENEMY_TYPES[e.type];
  if(parentBase && parentBase.splitsInto){
    const childKey=parentBase.splitsInto;
    const childBase=ENEMY_TYPES[childKey];
    const mul=getWaveMultiplier();
    for(let i=0;i<(parentBase.splitCount||2);i++){
      enemies.push({
        type:childKey,x:e.x+(Math.random()-0.5)*20,y:e.y+(Math.random()-0.5)*20,
        hp:Math.max(1,Math.floor(childBase.hp*mul.hp)),maxHp:Math.max(1,Math.floor(childBase.hp*mul.hp)),
        speed:childBase.speed*mul.speed,baseSpeed:childBase.speed*mul.speed,size:tinyAliensOn?childBase.size*0.4:childBase.size,
        reward:childBase.reward,color:childBase.color,segment:e.segment,distWalked:Math.max(0,e.distWalked-5),
        slowTimer:0,stunCooldown:0,stunInterval:0,stunRadius:0,stunDuration:0,stunned:0,cloakTimer:0,cloaked:false,bobSeed:Math.random()*1000
      });
    }
    if(!discoveredTypes.has(childKey)){ discoveredTypes.add(childKey); playSound("typeReveal"); }
    recordDiscovery("type",childKey);
  }
  updateHUD();
  if(e.isBoss){
    playSound("bossDown");
    metaData.stats.bossesKilled=(metaData.stats.bossesKilled||0)+1;
    if(e.areaIndex!==undefined){
      metaData.bossesDefeated=metaData.bossesDefeated||[];
      if(!metaData.bossesDefeated.includes(e.areaIndex)){
        metaData.bossesDefeated.push(e.areaIndex);
        saveToStorage(metaData);
      }
    }
    questNotifyProgress("boss",1);
    if(e.isFinalBoss) endGame("VICTORY");
  }
}

function createExplosion(x,y,color){
  const count=Math.max(2,Math.round(15*flashyMul()));
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2, s=2+Math.random()*4;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:20+Math.random()*10,size:2+Math.random()*3,color});
  }
}

function stunNearbyTowers(source){
  const radius=source.stunRadius||0, duration=source.stunDuration||0;
  if(radius<=0||duration<=0) return;
  for(const t of towers){
    const d=Math.hypot(t.x-source.x,t.y-source.y);
    if(d<=radius){
      const resisted=duration*(1-Math.min(90,t.stunResistPct||0)/100);
      t.stunTimer=Math.max(t.stunTimer||0,resisted);
    }
  }
  playSound("stun");
}

// ---------------------------------------------------------------------
// Equipment application (cards/armor equipped from the Inventory page)
// ---------------------------------------------------------------------
function applyItemBonus(t,defId,value){
  if(defId==="dmg"||defId==="plate") t.damage*=(1+value/100);
  else if(defId==="range"||defId==="visor") t.range*=(1+value/100);
  else if(defId==="fire"||defId==="servo"||defId==="cooldown"||defId==="coil") t.fireRate=Math.max(1,Math.round(t.fireRate*(1-value/100)));
  else if(defId==="splash"||defId==="core") t.splashBonusPct=(t.splashBonusPct||0)+value;
  else if(defId==="crit"||defId==="barb") t.critChance=(t.critChance||0)+value/100;
  else if(defId==="gold"||defId==="prism") t.goldBonusPct=(t.goldBonusPct||0)+value;
  else if(defId==="godslayer"||defId==="crown") t.bossDmgBonusPct=(t.bossDmgBonusPct||0)+value;
  else if(defId==="sink") t.armoredDmgBonusPct=(t.armoredDmgBonusPct||0)+value;
  else if(defId==="shell") t.stunResistPct=(t.stunResistPct||0)+value;
}
function consumeEquippedItem(type){
  const cardInstId=metaData.towerCardEquip?metaData.towerCardEquip[type]:null;
  const armorInstId=metaData.towerArmorEquip?metaData.towerArmorEquip[type]:null;
  let cardApplied=null, armorApplied=null;
  if(cardInstId){
    const inst=(metaData.cardInstances||[]).find(c=>c.id===cardInstId);
    if(inst && inst.durability>0){
      const def=POWERUP_DEFS.find(p=>p.id===inst.defId);
      if(def){ const idx=Math.max(0,Math.min(def.values.length-1,inst.level-1)); cardApplied={defId:inst.defId,value:def.values[idx]}; }
      inst.durability--;
      if(inst.durability<=0) delete metaData.towerCardEquip[type];
    }
  }
  if(armorInstId){
    const inst=(metaData.armorInstances||[]).find(c=>c.id===armorInstId);
    if(inst && inst.durability>0){
      const def=ARMOR_DEFS.find(a=>a.id===inst.defId);
      if(def){ const idx=Math.max(0,Math.min(def.values.length-1,inst.level-1)); armorApplied={defId:inst.defId,value:def.values[idx]}; }
      inst.durability--;
      if(inst.durability<=0) delete metaData.towerArmorEquip[type];
    }
  }
  if(cardApplied||armorApplied) saveToStorage(metaData);
  return {cardApplied,armorApplied};
}
function computeEffectiveDamage(t,baseDamage,target){
  let dmg=baseDamage;
  if(t && t.critChance && Math.random()<t.critChance) dmg*=2;
  if(t && target.isBoss && t.bossDmgBonusPct) dmg*=(1+t.bossDmgBonusPct/100);
  const eb=ENEMY_TYPES[target.type];
  if(t && eb && eb.armored && t.armoredDmgBonusPct) dmg*=(1+t.armoredDmgBonusPct/100);
  return dmg;
}

let gameSpeed=1, speedAccumulator=0;
let gameFreeze=false;
function setGameSpeed(s){
  gameSpeed=s;
  document.querySelectorAll(".speed-btn[data-speed]").forEach(b=>b.classList.toggle("active",parseFloat(b.dataset.speed)===s));
}
window.setGameSpeed=setGameSpeed;

function resumeLoopAfterFreeze(){
  gameFreeze=false;
  if(isPlaying && !isPaused){ draw(); gameLoopId=requestAnimationFrame(loop); }
}

function loop(){
  if(!isPlaying) return;
  if(netRole==="client"){
    if(selectedTower){
      const fresh=findTowerById(selectedTower.id);
      selectedTower=fresh||null;
      if(fresh) updateUpgradePanel(); else document.getElementById("upgrade-panel").style.display="none";
    }
    draw();
    gameLoopId=requestAnimationFrame(loop);
    return;
  }
  if(isPaused || gameFreeze) return;
  speedAccumulator+=gameSpeed;
  let steps=0;
  while(speedAccumulator>=1 && steps<6){ updateStep(); speedAccumulator-=1; steps++; if(!isPlaying || gameFreeze) break; }
  if(isPlaying && !isPaused && !gameFreeze){
    if(selectedTower) updateUpgradePanel();
    draw();
    netMaybeBroadcastState();
    gameLoopId=requestAnimationFrame(loop);
  }else if(isPlaying && !isPaused && gameFreeze){
    draw();
  }
}
function updateStep(){
  if(enemiesLeft>0){
    spawnTimer++;
    const spawnRate=Math.max(16,50-Math.min(24,wave*2));
    if(spawnTimer>spawnRate){ spawnEnemy(); spawnTimer=0; }
  }

  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(e.stunned>0){ e.stunned--; e.speed=0; }
    else if(e.slowTimer>0){ e.slowTimer--; e.speed=e.baseSpeed*.5; }
    else e.speed=e.baseSpeed;

    if(e.stunInterval>0 && e.stunned<=0){
      e.stunCooldown--;
      if(e.stunCooldown<=0){ stunNearbyTowers(e); e.stunCooldown=e.stunInterval; createExplosion(e.x,e.y,e.color); }
    }
    if(e.poisonTimer>0){
      e.poisonTimer--; e.hp-=e.poisonDps;
      if(e.hp<=0){ killEnemy(e,e.poisonSource); continue; }
    }
    const cloakBase=ENEMY_TYPES[e.type];
    if(cloakBase && cloakBase.cloakInterval){
      e.cloakTimer--;
      if(e.cloakTimer<=0){ e.cloaked=!e.cloaked; e.cloakTimer=e.cloaked?cloakBase.cloakDuration:cloakBase.cloakInterval; }
    }

    const wall=towers.find(t=>t.isWall);
    if(wall){
      const distToWall=Math.hypot(e.x-wall.x,e.y-wall.y);
      if(distToWall<40 && e.segment>=2){
        wall.wallHp-=0.3;
        if(wall.wallHp<=0){ towers=towers.filter(t=>t!==wall); flossWallPlaced=false; }
        continue;
      }
    }

    const target=path[e.segment+1];
    if(!target) continue;
    const dx=target.x-e.x, dy=target.y-e.y, dist=Math.hypot(dx,dy);
    if(dist<=Math.max(0.01,e.speed)){
      e.x=target.x; e.y=target.y; e.segment++;
      if(e.segment>=path.length-1){
        if(e.isBoss){ lives=0; enemies.splice(i,1); playSound("coreHit"); updateHUD(); endGame("CORE BREACHED"); }
        else{ lives--; enemies.splice(i,1); playSound("coreHit"); updateHUD(); if(lives<=0) endGame("CORE BREACHED"); }
      }
    }else{ e.x+=dx/dist*e.speed; e.y+=dy/dist*e.speed; e.distWalked+=e.speed; }
  }

  for(const t of towers){
    if(t.isWall) continue;
    if(t.stunTimer>0){ t.stunTimer--; continue; }
    t.target=null;
    let bestDist=-1;
    for(const e of enemies){
      if(e.cloaked) continue;
      if(Math.hypot(e.x-t.x,e.y-t.y)<=t.range && e.distWalked>bestDist){ bestDist=e.distWalked; t.target=e; }
    }
    if(oneHitModeOn && t.target){ t.target.hp=-9999; }
    if(t.type==="freeze"){
      if(t.cooldown<=0){
        for(const e of enemies){ if(!e.cloaked && Math.hypot(e.x-t.x,e.y-t.y)<=t.range){ const dmg=computeEffectiveDamage(t,t.damage,e); e.hp-=dmg; e.slowTimer=30; t.dmgDealt+=dmg; if(e.hp<=0) killEnemy(e,t); } }
        playSound("freeze"); t.cooldown=t.fireRate;
      }
    }else if(t.type==="flame" || t.type==="sandreaper" || t.type==="neonblade"){
      if(t.cooldown<=0){
        for(const e of enemies){ if(!e.cloaked && Math.hypot(e.x-t.x,e.y-t.y)<=t.range){ const dmg=computeEffectiveDamage(t,t.damage,e); e.hp-=dmg; t.dmgDealt+=dmg; if(e.hp<=0) killEnemy(e,t); } }
        t.cooldown=t.fireRate;
      }
    }else if(t.type==="vortex"){
      if(t.cooldown<=0){
        for(const e of enemies){ if(e.cloaked) continue;
          const dx2=t.x-e.x, dy2=t.y-e.y, d2=Math.hypot(dx2,dy2);
          if(d2<=t.range && d2>1){ e.x+=(dx2/d2)*0.6; e.y+=(dy2/d2)*0.6; const dmg=computeEffectiveDamage(t,t.damage,e); e.hp-=dmg; t.dmgDealt+=dmg; if(e.hp<=0) killEnemy(e,t); } }
        playSound("vortex"); t.cooldown=t.fireRate;
      }
    }else if(t.type==="emp"){
      if(t.cooldown<=0){
        for(const e of enemies){ if(!e.cloaked && Math.hypot(e.x-t.x,e.y-t.y)<=t.range){ const dmg=computeEffectiveDamage(t,t.damage,e); e.hp-=dmg; e.stunned=Math.max(e.stunned||0,70); t.dmgDealt+=dmg; if(e.hp<=0) killEnemy(e,t); } }
        playSound("emp"); t.cooldown=t.fireRate;
      }
    }else if(t.type==="blackhole"){
      if(t.cooldown<=0){
        for(const e of enemies){ if(!e.cloaked && Math.hypot(e.x-t.x,e.y-t.y)<=t.range){ const dmg=computeEffectiveDamage(t,t.damage,e); e.hp-=dmg; t.dmgDealt+=dmg; createExplosion(e.x,e.y,"#c084ff"); if(e.hp<=0) killEnemy(e,t); } }
        playSound("blackhole"); t.cooldown=t.fireRate;
      }
    }else if(t.type==="hijack"){
      if(!t.used && t.target && !t.target.isBoss){ t.used=true; playSound("hijack"); createExplosion(t.x,t.y,"#ff00ff"); }
    }else if(t.target && t.cooldown<=0){
      playSound("shoot");
      projectiles.push({x:t.x,y:t.y,target:t.target,speed:15,damage:t.damage,type:t.type,color:t.color,parent:t});
      t.cooldown=t.fireRate;
    }
    if(t.cooldown>0) t.cooldown--;
  }

  if(towers.some(t=>t.oneTime && t.used)){
    towers=towers.filter(t=>!(t.oneTime && t.used));
    if(selectedTower && !towers.includes(selectedTower)){ selectedTower=null; document.getElementById("upgrade-panel").style.display="none"; }
  }

  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    if(!enemies.includes(p.target)){ projectiles.splice(i,1); continue; }
    const dx=p.target.x-p.x, dy=p.target.y-p.y, dist=Math.hypot(dx,dy);
    if(dist<=p.speed){
      const dmg=computeEffectiveDamage(p.parent,p.damage,p.target);
      p.target.hp-=dmg; p.parent.dmgDealt+=dmg;
      const dyingTarget=p.target;
      createExplosion(p.target.x,p.target.y,p.color);
      const splashStat=TOWER_STATS[p.parent.type];
      if(splashStat && splashStat.splash){
        const radius=splashStat.splash*(1+((p.parent.splashBonusPct||0))/100);
        for(const other of enemies){
          if(other===dyingTarget || other.cloaked) continue;
          if(Math.hypot(other.x-dyingTarget.x,other.y-dyingTarget.y)<=radius){
            const splashDmg=dmg*0.5;
            other.hp-=splashDmg; p.parent.dmgDealt+=splashDmg;
            if(other.hp<=0) killEnemy(other,p.parent);
          }
        }
      }
      if(dyingTarget.hp<=0) killEnemy(dyingTarget,p.parent);
      if(p.type==="poison" && enemies.includes(dyingTarget)){ dyingTarget.poisonTimer=150; dyingTarget.poisonDps=5; dyingTarget.poisonSource=p.parent; }
      projectiles.splice(i,1);
    }else{ p.x+=dx/dist*p.speed; p.y+=dy/dist*p.speed; }
  }

  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    if(p.goldDrop){ p.life--; if(p.life<=0) particles.splice(i,1); continue; }
    p.x+=p.vx||0; p.y+=p.vy||0; p.life--;
    if(p.life<=0) particles.splice(i,1);
  }
}

function requestBuildTower(x,y,type){
  if(netRole==="client"){ netSendAction("placeTower",{x,y,type}); playSound("build"); return; }
  buildTower(x,y,type);
  playSound("build");
}
function buildTower(x,y,type){
  const s=TOWER_STATS[type];
  gold-=s.isWall?getFlossWallCost():s.cost;
  if(s.isWall) flossWallPlacementCount++;
  const t={
    id:nextTowerId(),
    x,y,type,name:s.name,
    range:s.range, damage:s.damage, fireRate:s.fireRate,
    color:s.color,
    cooldown:0,level:1,dmgDealt:0,angle:0,stunTimer:0,target:null,
    oneTime:!!s.oneTime,used:false,isWall:!!s.isWall,wallHp:s.wallHp||0,wallMaxHp:s.wallHp||0,
    flossed:false,isFlossling:false,
    critChance:0,splashBonusPct:0,goldBonusPct:0,bossDmgBonusPct:0,armoredDmgBonusPct:0,stunResistPct:0,
    equippedCardDefId:null,equippedArmorDefId:null
  };
  if(!t.isWall){
    const applied=consumeEquippedItem(type);
    if(applied.cardApplied){ applyItemBonus(t,applied.cardApplied.defId,applied.cardApplied.value); t.equippedCardDefId=applied.cardApplied.defId; }
    if(applied.armorApplied){ applyItemBonus(t,applied.armorApplied.defId,applied.armorApplied.value); t.equippedArmorDefId=applied.armorApplied.defId; }
    t.armored=!!applied.armorApplied || godArmorOn;
  }
  towers.push(t);
  if(type==="flosswall") flossWallPlaced=true;
  metaData.stats=metaData.stats||{};
  metaData.stats.towersBuilt=(metaData.stats.towersBuilt||0)+1;
  questNotifyProgress("build",1);
  updateHUD();
  renderShopCards();
}

function startGame(){
  resetScreenScroll();
  document.getElementById("game-container").style.display="flex";
  document.getElementById("game-over-screen").style.display="none";
  document.getElementById("winner-screen").style.display="none";
  towers=[]; resize();
  const mode=MODES[currentMode]||MODES.normal;
  gold=adminInfiniteCreditsOn ? 999999999 : (400+((metaData.goldLevel ?? 0)*50));
  lives=20; wave=0; killsThisGame=0;
  enemies=[]; projectiles=[]; particles=[];
  discoveredTypes=new Set();
  enemiesLeft=0; spawnTimer=0;
  selectedShopItem=null; selectedTower=null; moveModeTower=null;
  flossWallPlaced=false; flossWallPlacementCount=0; reviveUsedThisRun=false;
  isPaused=false;
  setGameSpeed(1);
  document.getElementById("upgrade-panel").style.display="none";
  document.getElementById("shop-panel").style.display="block";
  document.getElementById("shop-open-btn").style.display="none";
  renderShopCards();
  isPlaying=true;
  updateHUD();
  gameLoopId=requestAnimationFrame(loop);
  if(netRole==="host" && netConn && netConn.open) netConn.send({t:"start"});
}
window.startGame=startGame;

function togglePause(){
  if(!isPlaying) return;
  if(netRole==="client"){ netSendAction("togglePause",{}); return; }
  isPaused=!isPaused;
  document.getElementById("btn-pause").innerText=isPaused?"RESUME":"PAUSE";
  document.getElementById("btn-pause").classList.toggle("active",isPaused);
  if(!isPaused){ gameLoopId=requestAnimationFrame(loop); }
}
window.togglePause=togglePause;

function flossSelectedTower(){
  if(!selectedTower){ playSound("denied"); return; }
  flossTower(selectedTower);
  selectedTower=null;
  document.getElementById("upgrade-panel").style.display="none";
}
window.flossSelectedTower=flossSelectedTower;

function quitGame(){
  if(netRole==="client"){
    showConfirmModal("Leave co-op? Your teammate's mission will continue without you.", ()=>{
      isPlaying=false;
      cancelAnimationFrame(gameLoopId);
      netTeardown();
      window.location.href="index.html";
    });
    return;
  }
  showConfirmModal("Abort mission? You will save your Biomass, but the run will end.", ()=>{ endGame("ABORTED"); });
}
window.quitGame=quitGame;

function endGame(status){
  status=status||"CORE BREACHED";
  isPlaying=false;
  isPaused=false;
  cancelAnimationFrame(gameLoopId);
  if(netRole==="host" && netConn && netConn.open){ try{ netConn.send({t:"gameOver",status}); }catch(e){} }
  AudioEngine.stopMusic();
  playSound(status==="VICTORY"?"victory":"defeat");
  const previousBest=metaData.bestWave ?? 0;
  const previousUnlockedTowers=[...(metaData.unlockedAreaTowers||[])];
  metaData.runHistory=metaData.runHistory||[];
  metaData.runHistory.push({wave,kills:killsThisGame,mode:currentMode,date:Date.now(),name:getPlayerName()});
  if(metaData.runHistory.length>50) metaData.runHistory=metaData.runHistory.slice(-50);
  saveToStorage(metaData);
  lastDeathWave=wave;
  lastDeathWasBoss=enemies.some(e=>e.isBoss);
  if(lastDeathWasBoss){ savedBossSnapshot=enemies.filter(e=>e.isBoss).map(e=>({...e})); }

  const showOverlay=()=>{
    if(status==="VICTORY"){
      document.getElementById("win-wave").innerText=wave;
      document.getElementById("win-kills").innerText=killsThisGame;
      spawnConfetti();
      document.getElementById("winner-screen").style.display="flex";
      if(getAreaIndex()>=AREAS.length-1){ setTimeout(openEndCredits,2500); }
      return;
    }
    const title=document.getElementById("go-title");
    title.innerText=status;
    title.style.color= status==="ABORTED" ? "var(--purple)" : "var(--red)";
    document.getElementById("go-wave").innerText=wave;
    document.getElementById("go-kills").innerText=killsThisGame;
    document.getElementById("go-record").style.display=(wave>previousBest && wave>0) ? "block" : "none";
    const reviveBtn=document.getElementById("btn-revive");
    if(status==="CORE BREACHED" && !reviveUsedThisRun && netRole!=="client"){
      const cost=getReviveCost();
      reviveBtn.style.display="inline-block";
      reviveBtn.innerText="REVIVE ("+cost+" Biomass)";
      reviveBtn.disabled=(metaData.biomass||0)<cost;
    }else{
      reviveBtn.style.display="none";
    }
    document.getElementById("game-over-screen").style.display="flex";
  };

  apiPost("saveGameResult", { waveReached: wave, killsThisGame }).then(data=>{
    if(data) migrateMetaData(data);
    const newTowers=(metaData.unlockedAreaTowers||[]).filter(id=>!previousUnlockedTowers.includes(id));
    if(newTowers.length>0){ showTowerRewardScreen(newTowers[0], showOverlay); }
    else{ showOverlay(); }
  }).catch(()=>showOverlay());
}

function getReviveCost(){ return Math.floor(50+lastDeathWave*15); }
function requestRevive(){
  const cost=getReviveCost();
  if((metaData.biomass||0)<cost){ playSound("denied"); return; }
  metaData.biomass-=cost;
  saveToStorage(metaData);
  reviveUsedThisRun=true;
  resetScreenScroll();
  document.getElementById("game-over-screen").style.display="none";
  document.getElementById("game-container").style.display="flex";
  playSound("revive");
  isPlaying=true;
  lives=Math.max(lives,5);
  updateHUD();
  if(lastDeathWasBoss && savedBossSnapshot && savedBossSnapshot.length){
    enemies=[];
    for(const snap of savedBossSnapshot){ enemies.push({...snap, x:path[0].x, y:path[0].y, segment:0, distWalked:0}); }
  }
  document.getElementById("shop-panel").style.display="block";
  document.getElementById("shop-open-btn").style.display="none";
  gameLoopId=requestAnimationFrame(loop);
}
window.requestRevive=requestRevive;

function spawnConfetti(){
  const layer=document.getElementById("confetti-layer");
  layer.innerHTML="";
  const colors=["#ffd700","#39ff14","#00f0ff","#ff0055","#b026ff","#ffffff"];
  const count=Math.round(80*flashyMul());
  for(let i=0;i<count;i++){
    const piece=document.createElement("div");
    piece.className="confetti-piece";
    piece.style.left=Math.random()*100+"%";
    piece.style.background=colors[Math.floor(Math.random()*colors.length)];
    piece.style.animationDuration=(2.5+Math.random()*2.5)+"s";
    piece.style.animationDelay=(Math.random()*1.5)+"s";
    layer.appendChild(piece);
  }
}
function restartFromGameOver(){
  document.getElementById("game-over-screen").style.display="none";
  document.getElementById("winner-screen").style.display="none";
  startGame();
}
window.restartFromGameOver=restartFromGameOver;

function syncAreaMusic(){
  if(!isPlaying) return;
  const bossPresent=enemies.some(en=>en.isBoss);
  AudioEngine.playMusic(bossPresent ? "boss" : "area"+getAreaIndex());
}
function updateHUD(){
  document.getElementById("hud-gold").innerText=Math.floor(gold);
  document.getElementById("hud-wave").innerText=wave;
  document.getElementById("hud-lives").innerText=lives;
  document.getElementById("hud-area").innerText="AREA: "+getCurrentArea().name+"  ["+MODES[currentMode].name+"]";
  syncAreaMusic();
}
function selectShopItem(type){
  selectedShopItem=(selectedShopItem===type)?null:type;
  document.querySelectorAll(".tower-card").forEach(c=>c.classList.remove("active"));
  if(selectedShopItem){ const el=document.getElementById("card-"+selectedShopItem); if(el) el.classList.add("active"); }
  playSound("click");
}
window.selectShopItem=selectShopItem;

// ---------------------------------------------------------------------
// Themed path + area "core" structure
// ---------------------------------------------------------------------
const AREA_PATH_STYLE={
  hacker:    {color:"#0f3a18", edge:"#39ff14", dash:[]},
  volcano:   {color:"#3a1508", edge:"#ff6a00", dash:[]},
  arctic:    {color:"#284b5c", edge:"#cfefff", dash:[14,8]},
  desert:    {color:"#4a3a1a", edge:"#ffcf6b", dash:[]},
  space:     {color:"#12122a", edge:"#8fa0ff", dash:[3,11]},
  swamp:     {color:"#1c2a10", edge:"#8aff33", dash:[]},
  cyberpunk: {color:"#2a0a2a", edge:"#ff2fd0", dash:[16,6]},
  graveyard: {color:"#26262e", edge:"#b7ffcf", dash:[7,11]},
  underwater:{color:"#04283a", edge:"#33bbff", dash:[]},
  hive:      {color:"#2a0512", edge:"#ff1155", dash:[]}
};
function drawThemedPath(){
  const area=getCurrentArea();
  const style=AREA_PATH_STYLE[area.theme]||AREA_PATH_STYLE.hacker;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
  for(const p of path) ctx.lineTo(p.x,p.y);
  ctx.strokeStyle=style.color; ctx.lineWidth=45; ctx.lineCap="round"; ctx.setLineDash([]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
  for(const p of path) ctx.lineTo(p.x,p.y);
  ctx.strokeStyle=style.edge; ctx.lineWidth=3; ctx.globalAlpha=0.55*flashyMul()+0.15;
  ctx.setLineDash(style.dash);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
function drawAreaCore(){
  const area=getCurrentArea();
  const end=path[path.length-1];
  const x=Math.min(end.x,BASE_W-70), y=end.y;
  const fm=flashyMul();
  const pulse=(Math.sin(performance.now()/500)+1)/2;
  ctx.save();
  ctx.translate(x,y);
  switch(area.theme){
    case "hacker":
      ctx.fillStyle="#0a1a0a"; ctx.fillRect(-34,-60,68,120);
      ctx.strokeStyle="#39ff14"; ctx.lineWidth=3; ctx.shadowBlur=18*fm; ctx.shadowColor="#39ff14";
      ctx.strokeRect(-34,-60,68,120);
      ctx.font="bold 22px monospace"; ctx.fillStyle="#39ff14"; ctx.textAlign="center";
      ctx.fillText(">_",0,6+Math.sin(performance.now()/400)*2);
      for(let i=0;i<3;i++){ ctx.strokeRect(-24,-45+i*30,48,18); }
      break;
    case "volcano":
      ctx.fillStyle="#2a1206"; ctx.beginPath(); ctx.moveTo(-45,60); ctx.lineTo(-20,-55); ctx.lineTo(20,-55); ctx.lineTo(45,60); ctx.closePath(); ctx.fill();
      ctx.fillStyle=`rgba(255,${120+pulse*60},20,0.9)`; ctx.shadowBlur=22*fm; ctx.shadowColor="#ff6a00";
      ctx.beginPath(); ctx.arc(0,-58,10+pulse*4,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#ff6a00"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-10,20); ctx.lineTo(5,-10); ctx.lineTo(-5,-10); ctx.lineTo(10,-40); ctx.stroke();
      break;
    case "arctic":
      ctx.fillStyle="#dff6ff"; ctx.beginPath(); ctx.moveTo(-50,50); ctx.lineTo(0,-50); ctx.lineTo(50,50); ctx.closePath(); ctx.fill();
      ctx.strokeStyle="#8fd9ff"; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle="#aeeaff";
      for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(-18+i*18,-10); ctx.lineTo(-14+i*18,20); ctx.lineTo(-22+i*18,20); ctx.closePath(); ctx.fill(); }
      break;
    case "desert":
      ctx.fillStyle="#5a4322"; ctx.fillRect(-40,-45,80,105);
      ctx.fillStyle="#7a5c33"; ctx.fillRect(-48,50,96,14);
      ctx.strokeStyle="#ffcf6b"; ctx.lineWidth=2; ctx.shadowBlur=10*fm; ctx.shadowColor="#ffcf6b";
      for(let i=-1;i<=1;i++) ctx.strokeRect(-40+((i+1)*24),-30,16,20);
      break;
    case "space":
      ctx.fillStyle="#151530"; ctx.beginPath(); ctx.ellipse(0,0,42,58,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#8fa0ff"; ctx.lineWidth=2; ctx.shadowBlur=16*fm; ctx.shadowColor="#8fa0ff"; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0,-10+pulse*4,20,10,0,0,Math.PI*2); ctx.strokeStyle="#c9d6ff"; ctx.stroke();
      break;
    case "swamp":
      ctx.fillStyle="#33280f"; ctx.fillRect(-36,-40,16,100); ctx.fillRect(20,-40,16,100); ctx.fillRect(-36,-40,72,16);
      ctx.strokeStyle="#8aff33"; ctx.lineWidth=2; ctx.globalAlpha=0.5+pulse*0.3;
      ctx.strokeRect(-36,-40,72,100); ctx.globalAlpha=1;
      break;
    case "cyberpunk":
      ctx.fillStyle="#160a26"; ctx.fillRect(-28,-65,56,125);
      ctx.strokeStyle="#ff2fd0"; ctx.lineWidth=3; ctx.shadowBlur=20*fm; ctx.shadowColor="#ff2fd0"; ctx.strokeRect(-28,-65,56,125);
      ctx.beginPath(); ctx.arc(0,-20,20+pulse*6,0,Math.PI*2); ctx.strokeStyle="#00f0ff"; ctx.lineWidth=2; ctx.stroke();
      break;
    case "graveyard":
      ctx.fillStyle="#2a2a32"; ctx.beginPath(); ctx.moveTo(-30,55); ctx.lineTo(-30,-20); ctx.arc(0,-20,30,Math.PI,0); ctx.lineTo(30,55); ctx.closePath(); ctx.fill();
      ctx.strokeStyle="#b7ffcf"; ctx.lineWidth=2; ctx.globalAlpha=0.4+pulse*0.3; ctx.stroke(); ctx.globalAlpha=1;
      ctx.fillStyle="#1a1a20"; ctx.fillRect(-8,10,16,30);
      break;
    case "underwater":
      ctx.fillStyle="#0a3a4a"; ctx.beginPath(); ctx.arc(0,10,45,Math.PI,0); ctx.fill();
      ctx.strokeStyle="#33bbff"; ctx.lineWidth=2; ctx.shadowBlur=14*fm; ctx.shadowColor="#33bbff"; ctx.stroke();
      ctx.fillStyle="rgba(150,220,255,0.6)";
      for(let i=0;i<3;i++){ const yy=10-((performance.now()/40+i*20)%60); ctx.beginPath(); ctx.arc(-18+i*18,yy,3,0,Math.PI*2); ctx.fill(); }
      break;
    case "hive":
      ctx.fillStyle=`rgba(120,0,30,${0.7+pulse*0.2})`; ctx.beginPath(); ctx.ellipse(0,0,40,55,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#ff1155"; ctx.lineWidth=3; ctx.shadowBlur=20*fm; ctx.shadowColor="#ff1155"; ctx.stroke();
      ctx.fillStyle="#2a0009";
      for(let i=0;i<3;i++){ const a=-0.6+i*0.6; ctx.beginPath(); ctx.ellipse(Math.cos(a)*18,Math.sin(a)*22,7,10,a,0,Math.PI*2); ctx.fill(); }
      break;
    default:
      ctx.fillStyle="#222"; ctx.fillRect(-30,-45,60,100);
  }
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!path.length) return;
  const area=getCurrentArea();
  const grad=ctx.createRadialGradient(canvas.width/2,canvas.height/2,0,canvas.width/2,canvas.height/2,Math.max(canvas.width,canvas.height)*0.75);
  grad.addColorStop(0,area.bg[0]); grad.addColorStop(1,area.bg[1]);
  ctx.fillStyle=grad; ctx.fillRect(0,0,canvas.width,canvas.height);

  drawThemedPath();
  drawAreaCore();

  if(selectedShopItem){
    const stat=TOWER_STATS[selectedShopItem];
    const valid=isValidPlacement(mousePos.x,mousePos.y);
    ctx.save(); ctx.globalAlpha=.35;
    ctx.beginPath(); ctx.arc(mousePos.x,mousePos.y,stat.range||30,0,Math.PI*2);
    ctx.fillStyle=valid?stat.color:"rgba(255,0,0,.35)"; ctx.fill();
    ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(mousePos.x,mousePos.y,18,0,Math.PI*2);
    ctx.fillStyle=valid?stat.color:"#ff0000"; ctx.globalAlpha=.7; ctx.fill();
    ctx.restore();
  }
  if(selectedTower){
    ctx.beginPath(); ctx.arc(selectedTower.x,selectedTower.y,selectedTower.range,0,Math.PI*2);
    ctx.fillStyle="rgba(176,38,255,.1)"; ctx.fill();
    ctx.strokeStyle="#b026ff"; ctx.lineWidth=2; ctx.stroke();
  }

  for(const t of towers){
    if(t.isWall){
      ctx.save();
      const bob=Math.sin(performance.now()/300)*15;
      ctx.translate(t.x,t.y+bob);
      ctx.fillStyle="#eeeeee";
      ctx.fillRect(-8,-40,16,80);
      ctx.strokeStyle="#aaaaaa"; ctx.lineWidth=2; ctx.strokeRect(-8,-40,16,80);
      ctx.restore();
      ctx.fillStyle="#555"; ctx.fillRect(t.x-20,t.y-60,40,5);
      ctx.fillStyle="#39ff14"; ctx.fillRect(t.x-20,t.y-60,40*(Math.max(0,t.wallHp)/t.wallMaxHp),5);
      continue;
    }
    ctx.beginPath(); ctx.arc(t.x,t.y,22,0,Math.PI*2);
    ctx.fillStyle="#111"; ctx.fill();
    ctx.strokeStyle=t.color; ctx.lineWidth=3; ctx.stroke();
    if(t.armored){ ctx.beginPath(); ctx.arc(t.x,t.y,27,0,Math.PI*2); ctx.strokeStyle="#ffd700"; ctx.lineWidth=2; ctx.stroke(); }
    if(t.target){ t.angle=Math.atan2(t.target.y-t.y,t.target.x-t.x); }
    if(t.stunTimer>0){ ctx.beginPath(); ctx.arc(t.x,t.y,28,0,Math.PI*2); ctx.strokeStyle="rgba(255,0,85,.9)"; ctx.lineWidth=3; ctx.stroke(); }
    ctx.save(); ctx.translate(t.x,t.y); ctx.rotate(t.angle||0);
    drawTowerBarrel(ctx,t);
    ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fillStyle="#000"; ctx.fill();
    ctx.restore();
  }

  const drawOrderEnemies=[...enemies].sort((a,b)=>a.y-b.y);
  for(const e of drawOrderEnemies){ drawAlienBody(ctx,e); }

  if(pendingPlacement && selectedShopItem){
    ctx.save(); ctx.globalAlpha=0.5;
    ctx.beginPath(); ctx.arc(mousePos.x,mousePos.y,20,0,Math.PI*2);
    ctx.strokeStyle="#fff"; ctx.setLineDash([6,6]); ctx.lineWidth=3; ctx.stroke();
    ctx.restore();
  }

  for(const p of projectiles){
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2);
    ctx.fillStyle="#fff"; ctx.shadowBlur=10*flashyMul(); ctx.shadowColor=p.color; ctx.fill(); ctx.shadowBlur=0;
  }
  for(const p of particles){
    if(p.goldDrop){
      ctx.save(); ctx.translate(p.x,p.y+Math.sin(performance.now()/200)*3);
      ctx.fillStyle="#ffd700"; ctx.beginPath(); ctx.arc(0,0,p.size,0,Math.PI*2); ctx.fill();
      ctx.restore(); continue;
    }
    if(p.materialDrop){
      ctx.save(); ctx.translate(p.x,p.y+Math.sin(performance.now()/220)*3);
      ctx.fillStyle=MATERIAL_COLOR[p.mat]||"#9fd8a0";
      ctx.beginPath(); ctx.moveTo(0,-p.size); ctx.lineTo(p.size,0); ctx.lineTo(0,p.size); ctx.lineTo(-p.size,0); ctx.closePath(); ctx.fill();
      ctx.restore(); continue;
    }
    if(p.floatText){
      ctx.save();
      ctx.globalAlpha=Math.max(0,Math.min(1,(p.life||0)/45));
      ctx.fillStyle=p.color||"#fff";
      ctx.font="bold 30px Orbitron, sans-serif";
      ctx.textAlign="center";
      ctx.shadowBlur=12*flashyMul(); ctx.shadowColor=p.color||"#fff";
      ctx.fillText(p.text,p.x,p.y);
      ctx.restore(); continue;
    }
    ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
  }

  if(localCoopMode){
    ctx.save();
    ctx.strokeStyle="rgba(255,255,255,.35)";
    ctx.lineWidth=3; ctx.setLineDash([16,10]);
    ctx.beginPath(); ctx.moveTo(BASE_W/2,0); ctx.lineTo(BASE_W/2,BASE_H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font="bold 34px Orbitron, sans-serif"; ctx.textAlign="center";
    ctx.fillStyle="rgba(255,255,255,.55)";
    ctx.fillText("P1",BASE_W*0.25,50);
    ctx.fillText("P2",BASE_W*0.75,50);
    ctx.restore();
  }

  if(isPaused){
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#39ff14"; ctx.font="bold 90px Orbitron, sans-serif"; ctx.textAlign="center";
    ctx.shadowBlur=30; ctx.shadowColor="#39ff14";
    ctx.fillText("PAUSED",canvas.width/2,canvas.height/2);
    ctx.restore();
  }
}
resize();

// ---------------------------------------------------------------------
// Tower reward + end credits screens
// ---------------------------------------------------------------------
let towerRewardOnClose=null;
function showTowerRewardScreen(towerId,onClose){
  const stat=TOWER_STATS[towerId];
  if(!stat){ if(onClose) onClose(); return; }
  towerRewardOnClose=onClose||null;
  const icon=document.getElementById("tower-reward-icon");
  icon.style.borderColor=stat.color;
  icon.style.color=stat.color;
  icon.style.boxShadow=`0 0 30px ${stat.color}`;
  renderAlienIcon(document.getElementById("tower-reward-canvas"),"normal",{color:stat.color,size:26});
  const nameEl=document.getElementById("tower-reward-name");
  nameEl.innerText=stat.name;
  nameEl.style.color=stat.color;
  document.getElementById("tower-reward-desc").innerText=stat.desc;
  document.getElementById("tower-reward-screen").style.display="flex";
  playSound("winGodly");
}
function closeTowerReward(){
  document.getElementById("tower-reward-screen").style.display="none";
  const cb=towerRewardOnClose;
  towerRewardOnClose=null;
  if(cb) cb();
}
window.closeTowerReward=closeTowerReward;

function buildBossRollCallHtml(){
  const defeated=metaData.bossesDefeated||[];
  return AREAS.map((area,i)=>{
    const won=defeated.includes(i);
    const statusColor=won?"#7CFC00":"#8a5a00";
    return `<div class="ec-boss-line">${String(i+1).padStart(2,'0')} \u00b7 ${area.name} \u2014 ${area.boss.name} <span style="color:${statusColor};">${won?"[ SLAIN ]":"[ UNDEFEATED ]"}</span></div>`;
  }).join("");
}
function buildEndCreditsHtml(){
  return `
    <div class="ec-alien">&#128126;<span class="ec-tm">\u2122</span></div>
    <div class="ec-line" style="font-family:'Orbitron';font-size:2.2rem;letter-spacing:4px;">ALIEN TOWER DEFENSE</div>
    <div class="ec-role">GAME DESIGN</div><div class="ec-line">Isaac</div>
    <div class="ec-role">PROGRAMMING</div><div class="ec-line">Isaac</div>
    <div class="ec-role">ART &amp; VISUAL EFFECTS</div><div class="ec-line">Isaac</div>
    <div class="ec-role">MUSIC &amp; SOUND DESIGN</div><div class="ec-line">Isaac</div>
    <div class="ec-role">WRITING</div><div class="ec-line">Isaac</div>
    <div class="ec-role">QUALITY ASSURANCE</div><div class="ec-line">Isaac (he did not test it very much)</div>
    <div class="ec-role">A ROLL CALL OF THE FALLEN SECTOR BOSSES</div>
    ${buildBossRollCallHtml()}
    <div class="ec-role">SPECIAL THANKS</div>
    <div class="ec-line">My little brother, for the impostor idea</div>
    <div class="ec-line">You, for playing this</div>
    <div class="ec-role">EXECUTIVE PRODUCER</div><div class="ec-line">Also Isaac</div>
  `;
}
function openEndCredits(){
  const screen=document.getElementById("end-credits-screen");
  const scroll=document.getElementById("end-credits-scroll");
  const intro=document.getElementById("end-credits-intro");
  scroll.innerHTML=buildEndCreditsHtml();
  scroll.style.animation="none";
  if(intro) intro.style.animation="none";
  screen.style.display="flex";
  void scroll.offsetHeight;
  scroll.style.animation="";
  if(intro) intro.style.animation="";
  playSound("victory");
}
function closeEndCredits(){ document.getElementById("end-credits-screen").style.display="none"; }
window.openEndCredits=openEndCredits;
window.closeEndCredits=closeEndCredits;

// ---------------------------------------------------------------------
// ONLINE CO-OP (WebRTC via PeerJS, host-authoritative)
// ---------------------------------------------------------------------
let netRole=null;
let netPeer=null, netConn=null, netConnected=false, netRoomCode=null;
let netBroadcastFrameCounter=0;
let netHeartbeatInterval=null, netLastMsgAt=0;
const NET_ICE_SERVERS=[
  {urls:"stun:stun.l.google.com:19302"},
  {urls:"stun:stun.relay.metered.ca:80"},
  {urls:"turn:global.relay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turn:global.relay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turn:global.relay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"}
];
let netTowerIdSeq=1;
function nextTowerId(){ return netTowerIdSeq++; }
function findTowerById(id){ return towers.find(t=>t.id===id); }

// -- Invite links & friends quick-fill (local-only, no server) --------
function netBuildInviteLink(code){
  return window.location.origin+window.location.pathname+"?coop=online&join="+code;
}
function netCopyLinkToClipboard(text,statusPrefix){
  const done=()=>{ document.getElementById("coop-status").innerText=statusPrefix+" Invite link copied!"; };
  const fail=()=>{ document.getElementById("coop-status").innerText=statusPrefix+" Couldn't copy - link: "+text; };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(fail);
  }else{
    fail();
  }
}
function netCopyInviteLink(){
  if(!netRoomCode) return;
  netCopyLinkToClipboard(netBuildInviteLink(netRoomCode),"");
  playSound("click");
}
window.netCopyInviteLink=netCopyInviteLink;

function netOpenInviteFriendPicker(){
  if(!netRoomCode) return;
  const friends=metaData.friends||[];
  if(friends.length===0) return;
  const buttons=friends.map(f=>({
    label:f.name,
    onClick:()=>netInviteFriend(f)
  }));
  buttons.push({label:"CANCEL"});
  showModal("Send an invite link to:",buttons);
}
window.netOpenInviteFriendPicker=netOpenInviteFriendPicker;

function netInviteFriend(friend){
  friend.code=netRoomCode;
  saveToStorage(metaData);
  const link=netBuildInviteLink(netRoomCode);
  if(navigator.share){
    navigator.share({title:"Alien TD co-op",text:"Join my Alien TD squad, "+friend.name+"! Code: "+netRoomCode,url:link})
      .catch(()=>{ netCopyLinkToClipboard(link,"For "+friend.name+":"); });
  }else{
    netCopyLinkToClipboard(link,"For "+friend.name+":");
  }
}

function netRenderFriendsQuicklist(){
  const wrap=document.getElementById("coop-friends-quicklist");
  const friends=(metaData.friends||[]).filter(f=>f.code);
  if(!wrap) return;
  if(friends.length===0){ wrap.style.display="none"; wrap.innerHTML=""; return; }
  wrap.style.display="flex";
  wrap.innerHTML=`<div style="font-family:Arial;font-size:.72rem;color:#888;text-align:center;">Or fill in a saved friend's code:</div>`+
    friends.map(f=>`<button onclick="netFillJoinCode('${f.id}')" style="min-height:0;padding:.4em .8em;font-size:.78rem;color:var(--cyan);border-color:var(--cyan);box-shadow:none;">${escapeHtml(f.name)} - ${escapeHtml(f.code)}</button>`).join("");
}
function netFillJoinCode(friendId){
  const friend=(metaData.friends||[]).find(f=>f.id===friendId);
  if(!friend) return;
  document.getElementById("coop-join-input").value=friend.code;
  playSound("click");
}
window.netFillJoinCode=netFillJoinCode;

function netOpenModal(){
  document.getElementById("coop-overlay").style.display="flex";
  if(!netRole){
    document.getElementById("coop-choice-view").style.display="flex";
    document.getElementById("coop-host-view").style.display="none";
    document.getElementById("coop-join-view").style.display="none";
    document.getElementById("coop-waiting-view").style.display="none";
    document.getElementById("coop-status").innerText="";
  }
}
function netCloseModal(){ document.getElementById("coop-overlay").style.display="none"; }
window.netOpenModal=netOpenModal; window.netCloseModal=netCloseModal;

function netStartHost(){
  if(typeof Peer==="undefined"){
    document.getElementById("coop-status").innerText="Networking library failed to load. Check your connection and reload the page.";
    return;
  }
  netTeardown();
  netRole="host";
  document.getElementById("coop-choice-view").style.display="none";
  document.getElementById("coop-host-view").style.display="flex";
  document.getElementById("coop-host-code").innerText="....";
  document.getElementById("coop-status").innerText="Setting up...";
  const code=Math.random().toString(36).slice(2,6).toUpperCase();
  netRoomCode=code;
  document.getElementById("coop-invite-friend-btn").disabled=true;
  document.getElementById("coop-copy-link-btn").disabled=true;
  netPeer=new Peer("atd-"+code,{config:{iceServers:NET_ICE_SERVERS}});
  netPeer.on("open",()=>{
    document.getElementById("coop-host-code").innerText=code;
    document.getElementById("coop-status").innerText="Waiting for a teammate to join...";
    document.getElementById("coop-invite-friend-btn").disabled=(metaData.friends||[]).length===0;
    document.getElementById("coop-copy-link-btn").disabled=false;
  });
  netPeer.on("connection",c=>{
    if(netConn && netConn.open){ c.close(); return; }
    netSetupConn(c);
  });
  netPeer.on("error",err=>{
    document.getElementById("coop-status").innerText="Connection error ("+(err&&err.type||"unknown")+"). Try again.";
  });
}
window.netStartHost=netStartHost;

function netStartJoinView(prefillCode){
  document.getElementById("coop-choice-view").style.display="none";
  document.getElementById("coop-join-view").style.display="flex";
  document.getElementById("coop-join-input").value=prefillCode||"";
  document.getElementById("coop-status").innerText=prefillCode?"Code filled in from your invite link - hit CONNECT.":"";
  netRenderFriendsQuicklist();
}
window.netStartJoinView=netStartJoinView;

function netJoinSubmit(){
  const raw=document.getElementById("coop-join-input").value.trim().toUpperCase();
  if(!raw) return;
  if(typeof Peer==="undefined"){
    document.getElementById("coop-status").innerText="Networking library failed to load. Check your connection and reload the page.";
    return;
  }
  netTeardown();
  netRole="client";
  document.getElementById("coop-status").innerText="Connecting...";
  netPeer=new Peer({config:{iceServers:NET_ICE_SERVERS}});
  netPeer.on("open",()=>{
    const c=netPeer.connect("atd-"+raw,{reliable:true});
    netSetupConn(c);
  });
  netPeer.on("error",()=>{
    document.getElementById("coop-status").innerText="Couldn't connect. Check the code and try again.";
    netRole=null;
  });
}
window.netJoinSubmit=netJoinSubmit;

function netSetupConn(c){
  netConn=c;
  netConn.on("open",()=>{
    netConnected=true;
    netLastMsgAt=Date.now();
    netStartHeartbeat();
    if(netRole==="host"){
      document.getElementById("coop-status").innerText="Teammate connected! Deploying...";
      netHostBeginCountdown();
    }else{
      document.getElementById("coop-host-view").style.display="none";
      document.getElementById("coop-join-view").style.display="none";
      document.getElementById("coop-waiting-view").style.display="flex";
      document.getElementById("coop-status").innerText="Connected!";
    }
    netUpdateBadge();
  });
  netConn.on("data",msg=>{ netLastMsgAt=Date.now(); netHandleMessage(msg); });
  netConn.on("close",()=>netHandlePeerLeft());
  netConn.on("error",()=>netHandlePeerLeft());
}

let netCountdownTimer=null;
function netShowCountdown(n){
  const overlay=document.getElementById("coop-countdown-overlay");
  const numEl=document.getElementById("coop-countdown-number");
  if(!overlay||!numEl) return;
  overlay.style.display="flex";
  numEl.innerText=n>0?String(n):"GO!";
}
function netHideCountdown(){
  clearTimeout(netCountdownTimer); netCountdownTimer=null;
  const overlay=document.getElementById("coop-countdown-overlay");
  if(overlay) overlay.style.display="none";
}
function netHostBeginCountdown(){
  if(netRole!=="host") return;
  if(!netConn || !netConn.open){
    document.getElementById("coop-status").innerText="Connection isn't ready yet. Try again.";
    return;
  }
  netCloseModal();
  try{ netConn.send({t:"countdown"}); }catch(e){}
  let n=3;
  netShowCountdown(n);
  const tick=()=>{
    n--;
    if(!netConn || !netConn.open){ netHideCountdown(); return; }
    if(n>=0){ netShowCountdown(n); netCountdownTimer=setTimeout(tick,1000); }
    else{ netHideCountdown(); startGame(); }
  };
  netCountdownTimer=setTimeout(tick,1000);
}

function netStartHeartbeat(){
  clearInterval(netHeartbeatInterval);
  netHeartbeatInterval=setInterval(()=>{
    if(!netConn || !netConn.open){ return; }
    try{ netConn.send({t:"ping"}); }catch(e){}
    if(netLastMsgAt && Date.now()-netLastMsgAt>12000){ netHandlePeerLeft(); }
  },3000);
}
function netStopHeartbeat(){ clearInterval(netHeartbeatInterval); netHeartbeatInterval=null; }

function netCancelSetup(){ netTeardown(); netCloseModal(); window.location.href="index.html"; }
window.netCancelSetup=netCancelSetup;

function netTeardown(){
  netStopHeartbeat();
  netHideCountdown();
  if(netConn){ try{ netConn.close(); }catch(e){} netConn=null; }
  if(netPeer){ try{ netPeer.destroy(); }catch(e){} netPeer=null; }
  netRole=null; netConnected=false; netRoomCode=null;
}

function netHandlePeerLeft(){
  if(netConn===null && !netConnected) return;
  netStopHeartbeat();
  netHideCountdown();
  const wasHost=netRole==="host";
  const wasPlaying=isPlaying;
  netConnected=false; netConn=null;
  if(wasHost){
    if(wasPlaying) showAlertModal("Your teammate disconnected. You're now playing solo.",null);
    netRole=null; netPeer=null;
  }else{
    if(wasPlaying){
      isPlaying=false;
      cancelAnimationFrame(gameLoopId);
      showAlertModal("Connection to the host was lost.",()=>{ window.location.href="index.html"; });
    }
    netTeardown();
  }
  netUpdateBadge();
}

function netUpdateBadge(){
  const badge=document.getElementById("coop-badge");
  if(!badge) return;
  if(netRole==="host" && netConnected){ badge.style.display="inline-block"; badge.innerText="\uD83D\uDFE2 CO-OP HOST"; }
  else if(netRole==="client" && netConnected){ badge.style.display="inline-block"; badge.innerText="\uD83D\uDFE2 CO-OP GUEST"; }
  else{ badge.style.display="none"; }
}

function netSendAction(type,payload){
  if(!netConn || !netConn.open) return;
  try{ netConn.send({t:"action",type,payload}); }catch(e){}
}
function netHandleMessage(msg){
  if(!msg || !msg.t) return;
  if(msg.t==="ping"){ if(netConn && netConn.open){ try{ netConn.send({t:"pong"}); }catch(e){} } return; }
  if(msg.t==="pong") return;
  if(msg.t==="action" && netRole==="host") netApplyAction(msg.type,msg.payload);
  else if(msg.t==="state" && netRole==="client") netApplyState(msg);
  else if(msg.t==="countdown" && netRole==="client"){ netCloseModal(); netShowCountdown(3); }
  else if(msg.t==="start" && netRole==="client"){ netHideCountdown(); netEnterGameAsClient(); }
  else if(msg.t==="gameOver" && netRole==="client") endGame(msg.status);
}
function netApplyAction(type,payload){
  if(!isPlaying) return;
  if(type==="placeTower"){
    const stat=TOWER_STATS[payload.type];
    if(!stat) return;
    if(payload.type==="flosswall" && flossWallPlaced) return;
    const effCost=stat.isWall?getFlossWallCost():stat.cost;
    if(gold>=effCost && isValidPlacement(payload.x,payload.y)){ buildTower(payload.x,payload.y,payload.type); playSound("build"); }
  }else if(type==="upgradeTower"){ const t=findTowerById(payload.id); if(t) upgradeTower(t); }
  else if(type==="sellTower"){ const t=findTowerById(payload.id); if(t) sellTower(t); }
  else if(type==="moveTower"){ const t=findTowerById(payload.id); if(t) moveTowerTo(t,payload.x,payload.y); }
  else if(type==="flossTower"){ const t=findTowerById(payload.id); if(t) flossTower(t); }
  else if(type==="fuseFloss"){ const a=findTowerById(payload.aId), b=findTowerById(payload.bId); if(a && b) fuseFlosslings(a,b); }
  else if(type==="collectGold"){ tryCollectGoldDrop(payload.x,payload.y); }
  else if(type==="togglePause"){ togglePause(); }
}
function netMaybeBroadcastState(){
  if(netRole!=="host" || !netConn || !netConn.open) return;
  netBroadcastFrameCounter++;
  if(netBroadcastFrameCounter%2!==0) return;
  netSendState();
}
function netSendState(){
  const towersOut=towers.map(t=>{ const {target,...rest}=t; return rest; });
  try{
    netConn.send({
      t:"state", gold, lives, wave, enemiesLeft, isPaused, killsThisGame,
      towers:towersOut,
      enemies:enemies.map(e=>({...e})),
      projectiles:projectiles.map(p=>({x:p.x,y:p.y,color:p.color})),
      particles:particles.slice(-60).map(p=>({...p}))
    });
  }catch(e){}
}
function netApplyState(msg){
  if(!isPlaying){
    netHideCountdown();
    isPlaying=true;
    resetScreenScroll();
    document.getElementById("game-over-screen").style.display="none";
    document.getElementById("winner-screen").style.display="none";
    document.getElementById("game-container").style.display="flex";
    gameLoopId=requestAnimationFrame(loop);
  }
  gold=msg.gold; lives=msg.lives; wave=msg.wave; enemiesLeft=msg.enemiesLeft;
  killsThisGame=msg.killsThisGame;
  towers=msg.towers; enemies=msg.enemies; projectiles=msg.projectiles; particles=msg.particles;
  const wasPaused=isPaused;
  isPaused=msg.isPaused;
  if(wasPaused!==isPaused){
    const pb=document.getElementById("btn-pause");
    if(pb){ pb.innerText=isPaused?"RESUME":"PAUSE"; pb.classList.toggle("active",isPaused); }
  }
  updateHUD();
}
function netEnterGameAsClient(){
  netHideCountdown();
  resetScreenScroll();
  netCloseModal();
  document.getElementById("game-container").style.display="flex";
  document.getElementById("game-over-screen").style.display="none";
  document.getElementById("winner-screen").style.display="none";
  resize();
  towers=[]; enemies=[]; projectiles=[]; particles=[];
  selectedShopItem=null; selectedTower=null; moveModeTower=null;
  document.getElementById("upgrade-panel").style.display="none";
  document.getElementById("shop-panel").style.display="block";
  document.getElementById("shop-open-btn").style.display="none";
  renderShopCards();
  isPlaying=true; isPaused=false;
  updateHUD();
  netUpdateBadge();
  gameLoopId=requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------
// ADMIN — combat commands (meta commands are already wired to the same
// panel markup via shared/admin-meta.js)
// ---------------------------------------------------------------------
let adminInfiniteCreditsOn=false;
let adminAllTowersUnlocked=false;

function adminKillAllAliens(){
  if(!isPlaying || enemies.length===0){ adminStatus("No aliens on screen."); return; }
  const count=enemies.length;
  const snapshot=[...enemies];
  for(const e of snapshot){ if(enemies.includes(e)) killEnemy(e); }
  if(enemies.length>0){ enemies=[]; }
  updateHUD(); playSound("explode");
  adminStatus(`Cleared ${count} aliens.`);
}
function adminSkipWorld(){
  if(!isPlaying){ adminStatus("Start a mission first."); return; }
  enemies=[]; enemiesLeft=0; spawnTimer=0;
  const curArea=getAreaIndex();
  if(curArea>=AREAS.length-1){ endGame("VICTORY"); adminStatus("Final world cleared!"); return; }
  wave=(curArea+1)*10; updateHUD(); callNextWave();
  adminStatus("Skipped to "+AREAS[getAreaIndex()].name+".");
}
function adminInfiniteCredits(){ adminInfiniteCreditsOn=true; if(isPlaying) gold=999999999; updateHUD(); adminStatus("Infinite starting credits enabled."); }
function adminSpawnOmegaTower(){
  if(!isPlaying){ adminStatus("Start a mission first."); return; }
  selectedShopItem="omega";
  document.querySelectorAll(".tower-card").forEach(c=>c.classList.remove("active"));
  adminStatus("Click the battlefield to place it."); closeAdminPanel();
}
function adminSetCustomSpeed(){
  const raw=document.getElementById("admin-speed-input").value;
  const val=parseFloat(raw);
  if(!val||val<=0){ adminStatus("Enter a valid speed."); return; }
  setGameSpeed(val);
  document.querySelectorAll(".speed-btn[data-speed]").forEach(b=>b.classList.remove("active"));
  adminStatus(`Game speed set to ${val}x.`);
}
function adminSkipWave(){
  if(!isPlaying){ adminStatus("Start a mission first."); return; }
  enemies=[]; enemiesLeft=0; spawnTimer=0;
  const finalWave=AREAS.length*10;
  if(wave>=finalWave){ endGame("VICTORY"); adminStatus("Final boss skipped - victory!"); return; }
  callNextWave(); adminStatus("Skipped to wave "+wave+".");
}
function adminToggleAllTowers(){
  adminAllTowersUnlocked=!adminAllTowersUnlocked;
  document.getElementById("admin-alltowers-btn").innerText=adminAllTowersUnlocked?"CHOOSE ANY TOWER: ON":"CHOOSE ANY TOWER MID-GAME";
  if(isPlaying) renderShopCards();
  adminStatus(adminAllTowersUnlocked?"Any tower can now be built.":"Back to your equipped loadout.");
}
function adminSummonImpostor(){
  if(!isPlaying){ adminStatus("Start a mission first."); return; }
  const base=ENEMY_TYPES.impostor;
  const mul=getWaveMultiplier();
  enemies.push({type:"impostor",x:path[0].x,y:path[0].y,hp:Math.floor(base.hp*mul.hp),maxHp:Math.floor(base.hp*mul.hp),
    speed:base.speed*mul.speed,baseSpeed:base.speed*mul.speed,size:base.size,reward:base.reward,color:base.color,
    segment:0,distWalked:0,slowTimer:0,stunCooldown:0,stunInterval:0,stunRadius:0,stunDuration:0,stunned:0,
    cloakTimer:base.cloakInterval,cloaked:false,bobSeed:Math.random()*1000});
  recordDiscovery("type","impostor");
  adminStatus("The Impostor has been summoned. Sus.");
}
function adminFullHeal(){
  if(!isPlaying){ adminStatus("Start a mission first."); return; }
  lives=20; updateHUD(); adminStatus("Core shields fully restored.");
}
function adminHealCore1(){
  if(!isPlaying){ adminStatus("Start a mission first."); return; }
  lives+=1; updateHUD(); adminStatus("+1 core shield.");
}
function adminGodArmorAll(){
  godArmorOn=true;
  for(const t of towers){ if(!t.isWall) t.armored=true; }
  adminStatus("Secret OP armor applied to all current & future towers.");
}
function adminOneHitMode(){
  oneHitModeOn=!oneHitModeOn;
  adminStatus(oneHitModeOn?"One-hit-kill mode ON.":"One-hit-kill mode OFF.");
}
function adminTinyAliens(){
  tinyAliensOn=!tinyAliensOn;
  for(const e of enemies){ const base=ENEMY_TYPES[e.type]; if(base) e.size=tinyAliensOn?base.size*0.4:base.size; }
  adminStatus(tinyAliensOn?"Shrink ray ON - good luck clicking those.":"Shrink ray OFF.");
}
function adminDiscoBall(){
  discoBallLocalOn=!discoBallLocalOn;
  setDiscoBall(discoBallLocalOn);
  adminStatus(discoBallLocalOn?"Disco ball mode ON. \uD83D\uDD7A":"Disco ball mode OFF.");
}
function adminSpawnTinyBossArmy(){
  if(!isPlaying){ adminStatus("Start a mission first."); return; }
  for(let i=0;i<20;i++){
    const base=ENEMY_TYPES.boss;
    const mul=getWaveMultiplier();
    enemies.push({type:"boss",name:"Mini-Boss",x:path[0].x-i*10,y:path[0].y,hp:Math.floor(base.hp*0.1*mul.hp),maxHp:Math.floor(base.hp*0.1*mul.hp),
      speed:base.speed*mul.speed,baseSpeed:base.speed*mul.speed,size:base.size*0.5,reward:base.reward,color:base.color,
      segment:0,distWalked:0,slowTimer:0,stunCooldown:60,stunRadius:0,stunDuration:0,stunned:0,cloakTimer:0,cloaked:false,
      isBoss:false,bobSeed:Math.random()*1000});
  }
  adminStatus("20 mini-bosses spawned. RIP your core.");
}
function adminEndCredits(){ openEndCredits(); closeAdminPanel(); }

window.adminKillAllAliens=adminKillAllAliens;
window.adminSkipWorld=adminSkipWorld;
window.adminInfiniteCredits=adminInfiniteCredits;
window.adminSpawnOmegaTower=adminSpawnOmegaTower;
window.adminSetCustomSpeed=adminSetCustomSpeed;
window.adminSkipWave=adminSkipWave;
window.adminToggleAllTowers=adminToggleAllTowers;
window.adminSummonImpostor=adminSummonImpostor;
window.adminFullHeal=adminFullHeal;
window.adminHealCore1=adminHealCore1;
window.adminGodArmorAll=adminGodArmorAll;
window.adminOneHitMode=adminOneHitMode;
window.adminTinyAliens=adminTinyAliens;
window.adminDiscoBall=adminDiscoBall;
window.adminSpawnTinyBossArmy=adminSpawnTinyBossArmy;
window.adminEndCredits=adminEndCredits;

// ---------------------------------------------------------------------
// ENTRY POINT — this page is only ever navigated to with ?autostart=1
// (from "Deploy Defenses") or ?coop=online (from "Online Co-op").
// ---------------------------------------------------------------------
initMetaData(function(){
  ensureQuestsFresh();
  const params=new URLSearchParams(window.location.search);
  if(params.get("coop")==="online"){
    const joinCode=(params.get("join")||"").trim().toUpperCase().slice(0,4);
    netOpenModal();
    if(joinCode) netStartJoinView(joinCode);
  }else if(params.get("autostart")==="1"){
    startGame();
  }else{
    window.location.href="index.html";
  }
});
