// =======================================================================
// CRAFTING PAGE LOGIC
// =======================================================================
let craftTab="cards";
const CARD_FUSE_MATERIAL_COST={1:{common:5},2:{uncommon:5,rare:2}};
const ARMOR_FUSE_MATERIAL_COST={1:{common:6},2:{uncommon:6,rare:3}};
const CRATE_MATERIAL_COST={0:{common:15},1:{uncommon:10,rare:5},2:{rare:10,epic:5}};
const ARMOR_CRATE_MATERIAL_COST={0:{common:18},1:{uncommon:12,rare:6},2:{rare:12,epic:6}};

function hasMaterials(cost){
  const mats=metaData.materials||{};
  return Object.keys(cost).every(m=>(mats[m]||0)>=cost[m]);
}
function spendMaterials(cost){
  metaData.materials=metaData.materials||{};
  Object.keys(cost).forEach(m=>{ metaData.materials[m]=(metaData.materials[m]||0)-cost[m]; });
}
function materialCostText(cost){
  return Object.keys(cost).map(m=>`${cost[m]} <span style="color:${MATERIAL_COLOR[m]}">${MATERIAL_NAME[m]}</span>`).join(" + ");
}

function renderCraftMaterialsLine(){
  const mats=metaData.materials||{};
  document.getElementById("craft-materials-line").innerHTML="Materials: "+MATERIAL_TIERS.map(m=>`<span style="color:${MATERIAL_COLOR[m]}">${mats[m]||0} ${MATERIAL_NAME[m]}</span>`).join(" &middot; ");
}

function setCraftTab(tab){
  craftTab=tab;
  ["cards","crates","armor"].forEach(t=>{
    const btn=document.getElementById("craft-tab-"+t);
    if(btn) btn.classList.toggle("active",t===tab);
  });
  renderCraftMaterialsLine();
  if(tab==="cards") renderCraftCardsTab();
  else if(tab==="crates") renderCraftCratesTab();
  else if(tab==="armor") renderCraftArmorTab();
  playSound("click");
}
window.setCraftTab=setCraftTab;

function groupInstancesByDefLevel(list){
  const groups={};
  (list||[]).forEach(inst=>{
    const key=inst.defId+"_"+inst.level;
    (groups[key]=groups[key]||[]).push(inst);
  });
  return groups;
}

function craftCards(cardId,level){
  metaData.cardInstances=metaData.cardInstances||[];
  const def=POWERUP_DEFS.find(p=>p.id===cardId);
  if(!def || def.rarity==="godly") return {success:false,message:"Godly cards cannot be crafted."};
  if(level>=3) return {success:false,message:"Already max level."};
  const candidates=metaData.cardInstances.filter(c=>c.defId===cardId && c.level===level && c.durability===c.maxDurability);
  if(candidates.length<2) return {success:false,message:"Need 2 undamaged copies of level "+level+" to fuse."};
  const successChance=Math.max(0.15, 0.75-level*0.2-(RARITY_ORDER.indexOf(def.rarity)*0.08));
  const used=candidates.slice(0,2);
  metaData.cardInstances=metaData.cardInstances.filter(c=>!used.includes(c));
  if(Math.random()<successChance){
    metaData.cardInstances.push(newCardInstance(cardId,level+1));
    saveToStorage(metaData);
    return {success:true,message:def.name+" fused to Level "+(level+1)+"!"};
  }
  saveToStorage(metaData);
  return {success:false,message:"Fusion failed - materials lost."};
}
function craftArmor(armorId,level){
  metaData.armorInstances=metaData.armorInstances||[];
  const def=ARMOR_DEFS.find(a=>a.id===armorId);
  if(!def || def.rarity==="godly") return {success:false,message:"Godly armor cannot be crafted."};
  if(level>=3) return {success:false,message:"Already max level."};
  const candidates=metaData.armorInstances.filter(a=>a.defId===armorId && a.level===level && a.durability===a.maxDurability);
  if(candidates.length<2) return {success:false,message:"Need 2 undamaged copies of level "+level+" to fuse."};
  const successChance=Math.max(0.15, 0.75-level*0.2-(RARITY_ORDER.indexOf(def.rarity)*0.08));
  const used=candidates.slice(0,2);
  metaData.armorInstances=metaData.armorInstances.filter(a=>!used.includes(a));
  if(Math.random()<successChance){
    metaData.armorInstances.push(newArmorInstance(armorId,level+1));
    saveToStorage(metaData);
    return {success:true,message:def.name+" fused to Level "+(level+1)+"!"};
  }
  saveToStorage(metaData);
  return {success:false,message:"Fusion failed - armor lost."};
}

function renderCraftCardsTab(){
  const groups=groupInstancesByDefLevel(metaData.cardInstances);
  const rows=Object.keys(groups).map(key=>{
    const list=groups[key];
    const [id,lvlStr]=key.split("_"); const level=parseInt(lvlStr,10);
    const def=POWERUP_DEFS.find(p=>p.id===id);
    if(!def) return "";
    const undamaged=list.filter(c=>c.durability===c.maxDurability).length;
    const canFuseBase=undamaged>=2 && def.rarity!=="godly" && level<3;
    const cost=CARD_FUSE_MATERIAL_COST[level]||{};
    const canAfford=hasMaterials(cost);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #222;gap:10px;flex-wrap:wrap;">
      <span style="color:${RARITY_COLOR[def.rarity]};text-align:left;">${def.name} Lvl ${level} X${list.length} <span style="color:#888;font-size:.7rem;">(${undamaged} undamaged)</span><br><span style="color:#999;font-size:.72rem;">${powerupDescForLevel(def,level)}</span>${canFuseBase?`<br><span style="color:#888;font-size:.7rem;">Fuse cost: ${materialCostText(cost)}</span>`:""}</span>
      ${canFuseBase?`<button style="padding:.3em .7em;font-size:.7rem;min-height:0;flex-shrink:0;" ${canAfford?"":"disabled"} onclick="doCraftCard('${id}',${level})">FUSE</button>`:""}
    </div>`;
  }).join("");
  document.getElementById("crafting-content").innerHTML=(rows||`<div style="color:#666;">No cards yet - summon some from the Summoning page!</div>`)+
    `<div style="font-family:Arial;font-size:.72rem;color:#888;margin-top:10px;">Fusing needs 2 UNDAMAGED copies of the same level. Equip &amp; repair cards from the INVENTORY page.</div>`;
}
function doCraftCard(id,level){
  const cost=CARD_FUSE_MATERIAL_COST[level]||{};
  if(!hasMaterials(cost)){ playSound("denied"); showAlertModal("Not enough materials."); return; }
  spendMaterials(cost);
  const res=craftCards(id,level);
  playSound(res.success?"upgrade":"denied");
  showAlertModal(res.message);
  saveToStorage(metaData);
  renderCraftMaterialsLine();
  renderCraftCardsTab();
}
window.doCraftCard=doCraftCard;

function renderCraftCratesTab(){
  const rows=CRATES.map((c,i)=>{
    const cost=CRATE_MATERIAL_COST[i]||{};
    const canAfford=hasMaterials(cost);
    return `<div style="border:2px solid #ff6a2b55;border-radius:10px;padding:12px;margin-bottom:10px;">
      <b style="color:#ff6a2b;">${c.name}</b>
      <div style="font-size:.75rem;color:#888;margin:4px 0;">Cost: ${materialCostText(cost)}</div>
      <button style="width:100%;" ${canAfford?"":"disabled"} onclick="doCraftCrate(${i})">CRAFT &amp; OPEN</button>
    </div>`;
  }).join("");
  document.getElementById("crafting-content").innerHTML=rows;
}
function doCraftCrate(idx){
  const cost=CRATE_MATERIAL_COST[idx]||{};
  if(!hasMaterials(cost)){ playSound("denied"); showAlertModal("Not enough materials."); return; }
  spendMaterials(cost);
  const rarity=rollRarity(CRATES[idx].odds);
  const pool=POWERUP_DEFS.filter(p=>p.rarity===rarity);
  const won=pool[Math.floor(Math.random()*pool.length)] || POWERUP_DEFS[0];
  metaData.cardInstances=metaData.cardInstances||[];
  metaData.cardInstances.push(newCardInstance(won.id,1));
  metaData.stats.cratesOpened=(metaData.stats.cratesOpened||0)+1;
  questNotifyProgress("crate",1);
  saveToStorage(metaData);
  playSound(rarity==="godly"?"winGodly":(RARITY_ORDER.indexOf(rarity)>=3?"winRare":"winCommon"));
  showAlertModal("Crafted a "+(rarity==="godly"?"???":rarity.toUpperCase())+" card: "+won.name+" - "+powerupDescForLevel(won,1));
  renderCraftMaterialsLine();
  renderCraftCratesTab();
}
window.doCraftCrate=doCraftCrate;

function renderCraftArmorTab(){
  const groups=groupInstancesByDefLevel(metaData.armorInstances);
  const fuseRows=Object.keys(groups).map(key=>{
    const list=groups[key];
    const [id,lvlStr]=key.split("_"); const level=parseInt(lvlStr,10);
    const def=ARMOR_DEFS.find(a=>a.id===id);
    if(!def) return "";
    const undamaged=list.filter(c=>c.durability===c.maxDurability).length;
    const canFuseBase=undamaged>=2 && def.rarity!=="godly" && level<3;
    const cost=ARMOR_FUSE_MATERIAL_COST[level]||{};
    const canAfford=hasMaterials(cost);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #222;gap:10px;flex-wrap:wrap;">
      <span style="color:${RARITY_COLOR[def.rarity]};text-align:left;">${def.name} Lvl ${level} X${list.length} <span style="color:#888;font-size:.7rem;">(${undamaged} undamaged)</span><br><span style="color:#999;font-size:.72rem;">${armorDescForLevel(def,level)}</span>${canFuseBase?`<br><span style="color:#888;font-size:.7rem;">Fuse cost: ${materialCostText(cost)}</span>`:""}</span>
      ${canFuseBase?`<button style="padding:.3em .7em;font-size:.7rem;min-height:0;flex-shrink:0;" ${canAfford?"":"disabled"} onclick="doCraftArmorFuse('${id}',${level})">FUSE</button>`:""}
    </div>`;
  }).join("");
  const crateRows=ARMOR_CRATES.map((c,i)=>{
    const cost=ARMOR_CRATE_MATERIAL_COST[i]||{};
    const canAfford=hasMaterials(cost);
    return `<div style="border:2px solid var(--purple);border-radius:10px;padding:12px;margin-bottom:10px;">
      <b style="color:var(--purple);">${c.name}</b>
      <div style="font-size:.75rem;color:#888;margin:4px 0;">Cost: ${materialCostText(cost)}</div>
      <button style="width:100%;" ${canAfford?"":"disabled"} onclick="doCraftArmorCrate(${i})">CRAFT &amp; OPEN</button>
    </div>`;
  }).join("");
  document.getElementById("crafting-content").innerHTML=
    `<div style="color:#9fd8a0;font-size:.85rem;margin-bottom:8px;">Craft Armor Crates</div>${crateRows}
     <div style="color:#9fd8a0;font-size:.85rem;margin:14px 0 8px;">Fuse Owned Armor (needs 2 undamaged copies)</div>${fuseRows||'<div style="color:#666;">No armor yet - summon some from the Summoning page!</div>'}
     <div style="font-family:Arial;font-size:.72rem;color:#888;margin-top:10px;">Equip &amp; repair armor from the INVENTORY page.</div>`;
}
function doCraftArmorFuse(id,level){
  const cost=ARMOR_FUSE_MATERIAL_COST[level]||{};
  if(!hasMaterials(cost)){ playSound("denied"); showAlertModal("Not enough materials."); return; }
  spendMaterials(cost);
  const res=craftArmor(id,level);
  playSound(res.success?"upgrade":"denied");
  showAlertModal(res.message);
  saveToStorage(metaData);
  renderCraftMaterialsLine();
  renderCraftArmorTab();
}
window.doCraftArmorFuse=doCraftArmorFuse;
function doCraftArmorCrate(idx){
  const cost=ARMOR_CRATE_MATERIAL_COST[idx]||{};
  if(!hasMaterials(cost)){ playSound("denied"); showAlertModal("Not enough materials."); return; }
  spendMaterials(cost);
  const rarity=rollRarity(ARMOR_CRATES[idx].odds);
  const pool=ARMOR_DEFS.filter(a=>a.rarity===rarity);
  const won=pool[Math.floor(Math.random()*pool.length)] || ARMOR_DEFS[0];
  metaData.armorInstances=metaData.armorInstances||[];
  metaData.armorInstances.push(newArmorInstance(won.id,1));
  metaData.stats.armorCratesOpened=(metaData.stats.armorCratesOpened||0)+1;
  saveToStorage(metaData);
  playSound(rarity==="godly"?"winGodly":(RARITY_ORDER.indexOf(rarity)>=3?"winRare":"winCommon"));
  showAlertModal("Crafted a "+(rarity==="godly"?"???":rarity.toUpperCase())+" armor: "+won.name+" - "+armorDescForLevel(won,1));
  renderCraftMaterialsLine();
  renderCraftArmorTab();
}
window.doCraftArmorCrate=doCraftArmorCrate;

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme||"menu"));
  renderCraftMaterialsLine();
  setCraftTab("cards");
});
