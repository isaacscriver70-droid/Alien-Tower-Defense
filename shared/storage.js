// =======================================================================
// SHARED STORAGE — one save file, read/written by every page. Depends on
// shared/data.js being loaded first (TOWER_STATS, AREA_TOWER_*, etc).
// =======================================================================
const STORAGE_KEY="alienTD_playerData";
let memoryFallback=null;
let storageBlocked=false;

function loadFromStorage(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    return { ...defaultLocalState(), ...JSON.parse(raw) };
  }catch(e){
    storageBlocked=true;
    return memoryFallback ? { ...defaultLocalState(), ...memoryFallback } : null;
  }
}

const MAX_STORAGE_BYTES=5*1024*1024;

function saveToStorage(data){
  try{
    const json=JSON.stringify(data);
    const sizeBytes=new Blob([json]).size;
    if(sizeBytes>MAX_STORAGE_BYTES){
      storageBlocked=true;
      memoryFallback=data;
      return;
    }
    localStorage.setItem(STORAGE_KEY, json);
    memoryFallback=null;
    storageBlocked=false;
  }catch(e){
    storageBlocked=true;
    memoryFallback=data;
  }
}

function defaultSettings(){
  return { musicVolume:50, sfxVolume:60, muted:false, lobbyTheme:"menu", flashyLevel:100, autoReturnSummon:false, customThemes:defaultCustomThemes() };
}
function defaultCustomThemes(){
  return [
    {bg1:"#241832",bg2:"#050208",accent:"#ff6a2b",music:"area6"},
    {bg1:"#0a1a2a",bg2:"#000000",accent:"#33bbff",music:"area8"},
    {bg1:"#2a0505",bg2:"#000000",accent:"#ff1155",music:"area9"}
  ];
}

function defaultLocalState(){
  return {
    biomass:0,
    bestWave:0,
    goldLevel:0,
    ownedTowers:["acid"],
    maxSlots:2,
    equippedTowers:["acid"],
    settings:defaultSettings(),
    discoveredTypes:[],
    discoveredBosses:[],
    bossesDefeated:[],
    runHistory:[],
    summonTickets:0,
    areasEverCleared:0,
    unlockedAreaTowers:[],
    cardInstances:[],
    armorInstances:[],
    towerCardEquip:{},
    towerArmorEquip:{},
    nextInstId:1,
    materials:{common:0,uncommon:0,rare:0,epic:0,legendary:0},
    ownedSummonTowers:[],
    stats:{totalKills:0,cratesOpened:0,armorCratesOpened:0,towerCratesOpened:0,bossesKilled:0,towersBuilt:0,runsPlayed:0,biomassEarnedTotal:0,materialsCollectedTotal:0},
    achievementsClaimed:[],
    quests:null
  };
}

function apiGet(fn){
  return new Promise((resolve,reject)=>{
    if(fn==="loadPlayerData"){
      try{
        const data=loadFromStorage() || defaultLocalState();
        saveToStorage(data);
        resolve(data);
      }catch(e){
        resolve(defaultLocalState());
      }
    }else{
      reject(new Error("Unknown endpoint: "+fn));
    }
  });
}

function apiPost(fn, body){
  body=body||{};
  return new Promise((resolve)=>{
    let state;
    try{
      state=loadFromStorage() || defaultLocalState();
    }catch(e){
      resolve({success:false,message:"Local save error - see console for details.",data:defaultLocalState()});
      return;
    }
    try{
      if(fn==="buyMetaUpgrade"){
        const cost=50*((state.goldLevel??0)+1);
        if((state.biomass??0)<cost){ resolve({success:false,message:"Not enough Biomass.",data:state}); return; }
        state.biomass-=cost;
        state.goldLevel=(state.goldLevel??0)+1;
        saveToStorage(state);
        resolve({success:true,data:state});
        return;
      }
      if(fn==="buyTower"){
        const id=body.towerId;
        const stat=TOWER_STATS[id];
        if(!stat){ resolve({success:false,message:"Unknown tower.",data:state}); return; }
        if(state.ownedTowers.includes(id)){ resolve({success:false,message:"Already owned.",data:state}); return; }
        if(stat.areaLocked && !(state.unlockedAreaTowers||[]).includes(id)){
          resolve({success:false,message:"You must find this tower as a drop from its area first.",data:state}); return;
        }
        if((state.biomass??0)<stat.unlockCost){ resolve({success:false,message:"Not enough Biomass.",data:state}); return; }
        state.biomass-=stat.unlockCost;
        state.ownedTowers.push(id);
        saveToStorage(state);
        resolve({success:true,data:state});
        return;
      }
      if(fn==="setEquippedTowers"){
        const ids=body.towerIds||[];
        if(ids.length===0){ resolve({success:false,message:"You must keep at least one tower equipped.",data:state}); return; }
        if(ids.length>state.maxSlots){ resolve({success:false,message:"Not enough slots.",data:state}); return; }
        if(!ids.every(id=>state.ownedTowers.includes(id))){ resolve({success:false,message:"You don't own one of those towers.",data:state}); return; }
        state.equippedTowers=ids;
        saveToStorage(state);
        resolve({success:true,data:state});
        return;
      }
      if(fn==="buySlot"){
        if(state.maxSlots>=MAX_SLOTS_CLIENT){ resolve({success:false,message:"Max slots reached.",data:state}); return; }
        const cost=SLOT_COSTS_CLIENT[state.maxSlots+1];
        if((state.biomass??0)<cost){ resolve({success:false,message:"Not enough Biomass.",data:state}); return; }
        state.biomass-=cost;
        state.maxSlots+=1;
        saveToStorage(state);
        resolve({success:true,data:state});
        return;
      }
      if(fn==="saveGameResult"){
        const waveReached=body.waveReached||0;
        const kills=body.killsThisGame||0;
        state.biomass=(state.biomass??0)+kills;
        state.bestWave=Math.max(state.bestWave??0,waveReached);
        const areasCleared=Math.floor(waveReached/10);
        if(areasCleared>(state.areasEverCleared||0)){
          let newTickets=0;
          for(let a=(state.areasEverCleared||0)+1;a<=areasCleared;a++) newTickets+=a;
          state.summonTickets=(state.summonTickets||0)+newTickets;
          state.areasEverCleared=areasCleared;
          const areaIdx=areasCleared-1;
          const towerId=AREA_TOWER_UNLOCKS[areaIdx];
          if(towerId && !(state.unlockedAreaTowers||[]).includes(towerId)){
            state.unlockedAreaTowers=state.unlockedAreaTowers||[];
            if(Math.random()<AREA_TOWER_DROP_RATE){
              state.unlockedAreaTowers.push(towerId);
            }
          }
        }
        saveToStorage(state);
        resolve(state);
        return;
      }
      resolve(null);
    }catch(e){
      resolve({success:false,message:"Local save error - see console for details.",data:state});
    }
  });
}

let metaData=defaultLocalState();

function newCardInstance(cardId,level){
  const def=POWERUP_DEFS.find(p=>p.id===cardId);
  const rarity=def?def.rarity:"common";
  const max=LEVEL_DURABILITY[level]||1;
  metaData.nextInstId=(metaData.nextInstId||1);
  const id="c"+(metaData.nextInstId++);
  return {id,defId:cardId,level,rarity,durability:max,maxDurability:max};
}
function newArmorInstance(armorId,level){
  const def=ARMOR_DEFS.find(a=>a.id===armorId);
  const rarity=def?def.rarity:"common";
  const max=LEVEL_DURABILITY[level]||1;
  metaData.nextInstId=(metaData.nextInstId||1);
  const id="a"+(metaData.nextInstId++);
  return {id,defId:armorId,level,rarity,durability:max,maxDurability:max};
}

function recordDiscovery(kind,key){
  if(!metaData.discoveredTypes) metaData.discoveredTypes=[];
  if(!metaData.discoveredBosses) metaData.discoveredBosses=[];
  const list=kind==="type" ? metaData.discoveredTypes : metaData.discoveredBosses;
  if(!list.includes(key)){
    list.push(key);
    saveToStorage(metaData);
    return true;
  }
  return false;
}

function grantMaterial(mat,amount){
  metaData.materials=metaData.materials||{common:0,uncommon:0,rare:0,epic:0,legendary:0};
  metaData.materials[mat]=(metaData.materials[mat]||0)+amount;
  metaData.stats=metaData.stats||{};
  metaData.stats.materialsCollectedTotal=(metaData.stats.materialsCollectedTotal||0)+amount;
}

// Loads + migrates metaData, applies universal settings (audio volumes,
// flashy intensity, persistent-storage request), then hands off to the
// page's own onReady(metaData) callback. Every page calls this once.
function requestPersistentStorage(){
  if(!(navigator.storage && navigator.storage.persist)) return;
  navigator.storage.persisted().then(already=>{
    if(already) return;
    return navigator.storage.persist();
  }).catch(()=>{});
}

function migrateMetaData(data){
  metaData=data||metaData;
  if(!metaData.settings) metaData.settings=defaultSettings();
  if(metaData.settings.lobbyTheme===undefined) metaData.settings.lobbyTheme="menu";
  if(metaData.settings.flashyLevel===undefined){
    metaData.settings.flashyLevel = (metaData.settings.flashyMode===undefined) ? 100 : (metaData.settings.flashyMode?100:0);
  }
  if(metaData.settings.customThemes===undefined) metaData.settings.customThemes=defaultCustomThemes();
  if(metaData.summonTickets===undefined) metaData.summonTickets=0;
  if(metaData.unlockedAreaTowers===undefined) metaData.unlockedAreaTowers=[];
  if(metaData.materials===undefined) metaData.materials={common:0,uncommon:0,rare:0,epic:0,legendary:0};
  if(metaData.ownedSummonTowers===undefined) metaData.ownedSummonTowers=[];
  if(metaData.stats===undefined) metaData.stats={totalKills:0,cratesOpened:0,armorCratesOpened:0,towerCratesOpened:0,bossesKilled:0,towersBuilt:0,runsPlayed:0,biomassEarnedTotal:0,materialsCollectedTotal:0};
  if(metaData.achievementsClaimed===undefined) metaData.achievementsClaimed=[];
  if(metaData.bossesDefeated===undefined) metaData.bossesDefeated=[];
  if(metaData.runHistory===undefined) metaData.runHistory=[];
  if(metaData.settings.autoReturnSummon===undefined) metaData.settings.autoReturnSummon=false;

  if(metaData.cardInstances===undefined) metaData.cardInstances=[];
  if(metaData.armorInstances===undefined) metaData.armorInstances=[];
  if(metaData.towerCardEquip===undefined) metaData.towerCardEquip={};
  if(metaData.towerArmorEquip===undefined) metaData.towerArmorEquip={};
  if(metaData.nextInstId===undefined) metaData.nextInstId=1;
  if(metaData.powerups){
    Object.keys(metaData.powerups).forEach(key=>{
      const parts=key.split("_"); const id=parts[0]; const lvl=parseInt(parts[1],10)||1;
      const count=metaData.powerups[key]||0;
      for(let i=0;i<count;i++) metaData.cardInstances.push(newCardInstance(id,lvl));
    });
    delete metaData.powerups;
  }
  if(metaData.armors){
    Object.keys(metaData.armors).forEach(key=>{
      const parts=key.split("_"); const id=parts[0]; const lvl=parseInt(parts[1],10)||1;
      const count=metaData.armors[key]||0;
      for(let i=0;i<count;i++) metaData.armorInstances.push(newArmorInstance(id,lvl));
    });
    delete metaData.armors;
  }
  delete metaData.equippedPowerups;
  delete metaData.equippedArmor;
  return metaData;
}

// Call once per page: initMetaData(function(metaData){ ...render page... })
function initMetaData(onReady){
  requestPersistentStorage();
  apiGet("loadPlayerData")
    .then(data=>{
      migrateMetaData(data);
      saveToStorage(metaData);
      if(typeof applyFlashyLevel==="function") applyFlashyLevel(metaData.settings.flashyLevel);
      if(typeof AudioEngine!=="undefined"){
        AudioEngine.setMusicVolume(metaData.settings.musicVolume/100);
        AudioEngine.setSfxVolume(metaData.settings.sfxVolume/100);
        AudioEngine.setMuted(!!metaData.settings.muted);
      }
      onReady(metaData);
    })
    .catch(()=>{
      migrateMetaData(defaultLocalState());
      onReady(metaData);
    });
}
