// =======================================================================
// INVENTORY PAGE LOGIC
// =======================================================================
let invView="hub";
function invGoto(v){ invView=v; renderInventory(); playSound("click"); }
window.invGoto=invGoto;
function invBackButton(target){ return `<a class="btn-link summon-back-btn" href="javascript:void(0)" onclick="invGoto('${target||'hub'}')">&#8592; BACK</a>`; }

function towerEligibleList(){
  return (metaData.ownedTowers||[]).filter(id=>TOWER_STATS[id] && !TOWER_STATS[id].admin && !TOWER_STATS[id].isWall);
}
function invEquipCostForTower(towerId){
  const stat=TOWER_STATS[towerId];
  return stat?Math.ceil(stat.cost*0.25):0;
}

function renderInventory(){
  const el=document.getElementById("inventory-content");
  if(invView==="hub"){
    el.innerHTML=`
      <div style="font-family:Arial;color:#ccc;margin-bottom:16px;line-height:1.5;">
        Equip cards and armor onto a specific tower TYPE. Equipping costs Biomass equal to 25% of that tower's credit cost.
        Every time you build that tower type in a run, the equipped item applies its bonus and loses 1 durability - Level 1 gear
        lasts 1 use, Level 2 lasts 3 uses, Level 3 lasts 6 uses. Broken gear can be repaired below.
      </div>
      <div class="summon-section-grid">
        <div class="summon-section-card" style="border-color:#ff6a2b;" onclick="invGoto('cards')">
          <div class="ssc-icon">&#127183;</div><div class="ssc-title" style="color:#ff6a2b;">CARDS</div>
        </div>
        <div class="summon-section-card" style="border-color:var(--purple);" onclick="invGoto('armor')">
          <div class="ssc-icon">&#128737;&#65039;</div><div class="ssc-title" style="color:var(--purple);">ARMOR</div>
        </div>
        <div class="summon-section-card" style="border-color:var(--cyan);" onclick="invGoto('repair')">
          <div class="ssc-icon">&#128295;</div><div class="ssc-title" style="color:var(--cyan);">REPAIR</div>
        </div>
      </div>`;
  }else if(invView==="cards"){ renderInvEquip("card"); }
  else if(invView==="armor"){ renderInvEquip("armor"); }
  else if(invView==="repair"){
    el.innerHTML=`
      ${invBackButton("hub")}
      <div style="height:8px;"></div>
      <div class="summon-section-grid">
        <div class="summon-section-card" style="border-color:#ff6a2b;" onclick="invGoto('repair-cards')">
          <div class="ssc-icon">&#127183;</div><div class="ssc-title" style="color:#ff6a2b;">CARD REPAIR</div>
        </div>
        <div class="summon-section-card" style="border-color:var(--purple);" onclick="invGoto('repair-armor')">
          <div class="ssc-icon">&#128737;&#65039;</div><div class="ssc-title" style="color:var(--purple);">ARMOR REPAIR</div>
        </div>
      </div>`;
  }else if(invView==="repair-cards"){ renderInvRepair("card"); }
  else if(invView==="repair-armor"){ renderInvRepair("armor"); }
}

function renderInvEquip(kind){
  const el=document.getElementById("inventory-content");
  const isCard=kind==="card";
  const insts=(isCard?(metaData.cardInstances||[]):(metaData.armorInstances||[])).slice()
    .sort((a,b)=>b.level-a.level || RARITY_ORDER.indexOf(b.rarity)-RARITY_ORDER.indexOf(a.rarity));
  const defs=isCard?POWERUP_DEFS:ARMOR_DEFS;
  const equipMap=isCard?(metaData.towerCardEquip||{}):(metaData.towerArmorEquip||{});
  const towerOptions=towerEligibleList();
  const eligibleIds=isCard?TOWER_EQUIPPABLE_CARD_IDS:defs.map(d=>d.id);
  const rows=insts.map(inst=>{
    const def=defs.find(d=>d.id===inst.defId);
    if(!def) return "";
    const broken=inst.durability<=0;
    const equipTarget=Object.keys(equipMap).find(tid=>equipMap[tid]===inst.id);
    const barColor=broken?"var(--red)":(inst.durability<inst.maxDurability?"#ffae00":"var(--green)");
    const notEquippable=isCard && !eligibleIds.includes(inst.defId);
    const descText=isCard?powerupDescForLevel(def,inst.level):armorDescForLevel(def,inst.level);
    let controlsHtml;
    if(notEquippable){
      controlsHtml=`<div style="font-family:Arial;font-size:.72rem;color:#888;margin-top:8px;">This card is an account-wide passive and isn't tower-equippable in this version.</div>`;
    }else{
      const selectOptions=towerOptions.map(tid=>{
        const occupied=equipMap[tid] && equipMap[tid]!==inst.id;
        return `<option value="${tid}" ${equipTarget===tid?"selected":""}>${TOWER_STATS[tid].name} (${invEquipCostForTower(tid)} Bio)${occupied?" [replaces equipped]":""}</option>`;
      }).join("");
      controlsHtml=`<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center;">
        <select id="sel-${inst.id}" style="flex:1;min-width:150px;background:rgba(0,0,0,.6);color:#39ff14;border:2px solid #39ff14;border-radius:8px;padding:.3em .5em;font-family:Arial;font-size:.8rem;" ${broken||towerOptions.length===0?"disabled":""}>
          ${selectOptions||'<option>No owned towers</option>'}
        </select>
        ${equipTarget?`<button class="armory-btn unequip" onclick="unequipItem('${kind}','${inst.id}')">UNEQUIP</button>`
          :`<button class="armory-btn" ${broken||towerOptions.length===0?"disabled":""} onclick="equipItem('${kind}','${inst.id}')">EQUIP</button>`}
      </div>`;
    }
    return `<div class="armory-card" style="flex-direction:column;align-items:stretch;">
      <div class="a-info">
        <div class="a-name" style="color:${RARITY_COLOR[def.rarity]}">${def.name} Lvl ${inst.level}${broken?' <span style="color:var(--red);">[BROKEN]</span>':''}${equipTarget?' <span style="color:var(--green);">[EQUIPPED: '+TOWER_STATS[equipTarget].name+']</span>':''}</div>
        <div class="a-desc">${descText}</div>
        <div style="font-size:.72rem;color:${barColor};margin-top:4px;">Durability: ${inst.durability} / ${inst.maxDurability}</div>
      </div>
      ${controlsHtml}
    </div>`;
  }).join("");
  el.innerHTML=`${invBackButton("hub")}<div style="height:8px;"></div>${rows||`<div style="color:#666;">No ${isCard?"cards":"armor"} yet - summon some from the Summoning page!</div>`}`;
}

function equipItem(kind,instId){
  const isCard=kind==="card";
  const list=isCard?metaData.cardInstances:metaData.armorInstances;
  const inst=(list||[]).find(c=>c.id===instId);
  if(!inst || inst.durability<=0){ playSound("denied"); return; }
  const sel=document.getElementById("sel-"+instId);
  const towerId=sel?sel.value:null;
  if(!towerId || !TOWER_STATS[towerId]){ playSound("denied"); return; }
  const cost=invEquipCostForTower(towerId);
  if((metaData.biomass||0)<cost){ playSound("denied"); showAlertModal("Not enough Biomass ("+cost+" needed)."); return; }
  const equipMap=isCard?(metaData.towerCardEquip=metaData.towerCardEquip||{}):(metaData.towerArmorEquip=metaData.towerArmorEquip||{});
  Object.keys(equipMap).forEach(tid=>{ if(equipMap[tid]===instId) delete equipMap[tid]; });
  metaData.biomass-=cost;
  equipMap[towerId]=instId;
  saveToStorage(metaData);
  playSound("build");
  renderInvEquip(kind);
}
function unequipItem(kind,instId){
  const isCard=kind==="card";
  const equipMap=isCard?(metaData.towerCardEquip=metaData.towerCardEquip||{}):(metaData.towerArmorEquip=metaData.towerArmorEquip||{});
  Object.keys(equipMap).forEach(tid=>{ if(equipMap[tid]===instId) delete equipMap[tid]; });
  saveToStorage(metaData);
  playSound("click");
  renderInvEquip(kind);
}
window.equipItem=equipItem;
window.unequipItem=unequipItem;

function renderInvRepair(kind){
  const el=document.getElementById("inventory-content");
  const isCard=kind==="card";
  const insts=isCard?(metaData.cardInstances||[]):(metaData.armorInstances||[]);
  const defs=isCard?POWERUP_DEFS:ARMOR_DEFS;
  const damaged=insts.filter(c=>c.durability<c.maxDurability);
  if(damaged.length===0){
    el.innerHTML=`${invBackButton("repair")}<div style="color:#666;margin-top:14px;">No damaged ${isCard?"cards":"armor"} to repair.</div>`;
    return;
  }
  const rows=damaged.map(inst=>{
    const def=defs.find(d=>d.id===inst.defId);
    if(!def) return "";
    const info=RARITY_REPAIR_INFO[def.rarity]||RARITY_REPAIR_INFO.common;
    const donors=insts.filter(o=>o.id!==inst.id && o.defId===inst.defId && o.durability>=info.amount);
    const donorOptions=donors.map(o=>`<option value="${o.id}">Lvl ${o.level} (Durability ${o.durability}/${o.maxDurability})</option>`).join("");
    const canAfford=(metaData.biomass||0)>=info.cost;
    return `<div class="armory-card" style="flex-direction:column;align-items:stretch;">
      <div class="a-info">
        <div class="a-name" style="color:${RARITY_COLOR[def.rarity]}">${def.name} Lvl ${inst.level}${inst.durability<=0?' <span style="color:var(--red);">[BROKEN]</span>':''}</div>
        <div style="font-size:.72rem;color:#ccc;margin-top:3px;">Durability: ${inst.durability} / ${inst.maxDurability}</div>
        <div style="font-size:.72rem;color:#888;margin-top:3px;">Repair cost: ${info.cost} Biomass &middot; needs a donor with &ge;${info.amount} durability (${def.rarity} rarity)</div>
      </div>
      ${donors.length>0?`
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center;">
        <select id="donor-${inst.id}" style="flex:1;min-width:170px;background:rgba(0,0,0,.6);color:#39ff14;border:2px solid #39ff14;border-radius:8px;padding:.3em .5em;font-family:Arial;font-size:.8rem;">
          ${donorOptions}
        </select>
        <button class="armory-btn" ${canAfford?"":"disabled"} onclick="doRepair('${kind}','${inst.id}')">REPAIR</button>
      </div>`:`<div style="font-size:.72rem;color:#888;margin-top:6px;">No eligible donor copy (need another ${def.name} with enough spare durability).</div>`}
    </div>`;
  }).join("");
  el.innerHTML=`${invBackButton("repair")}<div style="height:8px;"></div>${rows}`;
}

function doRepair(kind,targetId){
  const isCard=kind==="card";
  const list=isCard?metaData.cardInstances:metaData.armorInstances;
  const defs=isCard?POWERUP_DEFS:ARMOR_DEFS;
  const target=(list||[]).find(c=>c.id===targetId);
  if(!target){ playSound("denied"); return; }
  const def=defs.find(d=>d.id===target.defId);
  const info=RARITY_REPAIR_INFO[def.rarity]||RARITY_REPAIR_INFO.common;
  const sel=document.getElementById("donor-"+targetId);
  const donorId=sel?sel.value:null;
  const donor=list.find(c=>c.id===donorId);
  if(!donor || donor.durability<info.amount){ playSound("denied"); showAlertModal("Invalid donor."); return; }
  if((metaData.biomass||0)<info.cost){ playSound("denied"); showAlertModal("Not enough Biomass."); return; }
  metaData.biomass-=info.cost;
  donor.durability-=info.amount;
  target.durability=Math.min(target.maxDurability,target.durability+info.amount);
  const equipMap=isCard?metaData.towerCardEquip:metaData.towerArmorEquip;
  if(donor.durability<=0 && equipMap){
    Object.keys(equipMap).forEach(tid=>{ if(equipMap[tid]===donor.id) delete equipMap[tid]; });
  }
  saveToStorage(metaData);
  playSound("upgrade");
  renderInvRepair(kind);
}
window.doRepair=doRepair;

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme||"menu"));
  renderInventory();
});
