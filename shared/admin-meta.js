// =======================================================================
// SHARED ADMIN (META COMMANDS) — the code-unlock flow + the subset of
// admin commands that only touch metaData (not a live game session).
// game.html loads this too, then layers extra COMBAT commands on top
// (see game.js's admin section) into the same panel.
// =======================================================================
const ADMIN_CODE="23230404";
let adminUnlocked=false;

function openAdminCodeModal(){
  if(adminUnlocked){ openAdminPanel(); return; }
  document.getElementById("admin-code-input").value="";
  document.getElementById("admin-code-error").innerText="";
  document.getElementById("admin-code-overlay").style.display="flex";
  document.getElementById("admin-code-input").focus();
}
function closeAdminCodeModal(){ document.getElementById("admin-code-overlay").style.display="none"; }
function submitAdminCode(){
  const val=document.getElementById("admin-code-input").value.trim();
  if(val===ADMIN_CODE){ adminUnlocked=true; closeAdminCodeModal(); openAdminPanel(); }
  else{ document.getElementById("admin-code-error").innerText="Incorrect code."; playSound("denied"); }
}
function openAdminPanel(){ document.getElementById("admin-panel").style.display="block"; }
function closeAdminPanel(){ document.getElementById("admin-panel").style.display="none"; }
function adminStatus(msg){
  const el=document.getElementById("admin-status");
  if(!el) return;
  el.innerText=msg;
  clearTimeout(adminStatus._t);
  adminStatus._t=setTimeout(()=>{ el.innerText=""; },2200);
}

function adminInfiniteBiomass(){
  metaData.biomass=999999999; saveToStorage(metaData);
  if(typeof updateMenuUI==="function") updateMenuUI();
  adminStatus("Biomass set to 999,999,999.");
}
function adminInfiniteMaterials(){
  metaData.materials=metaData.materials||{};
  MATERIAL_TIERS.forEach(m=>{ metaData.materials[m]=999999; });
  saveToStorage(metaData);
  adminStatus("All materials set to 999,999.");
}
function adminInfiniteSummonTickets(){
  metaData.summonTickets=999999;
  saveToStorage(metaData);
  if(typeof updateMenuUI==="function") updateMenuUI();
  adminStatus("Summoning Tickets set to 999,999.");
}
function adminUnlockBestiary(){
  metaData.discoveredTypes=[...BEAST_ORDER];
  metaData.discoveredBosses=AREAS.map((a,i)=>i);
  saveToStorage(metaData);
  if(typeof buildBestiary==="function" && document.getElementById("bestiary-screen")) buildBestiary();
  adminStatus("All bestiary entries unlocked.");
}
function adminInfiniteSlots(){
  metaData.maxSlots=999; saveToStorage(metaData);
  if(typeof renderArmory==="function") renderArmory();
  adminStatus("Equip slots are now unlimited.");
}
function adminGiveTicket(){
  metaData.summonTickets=(metaData.summonTickets||0)+5;
  saveToStorage(metaData);
  adminStatus("+5 Summoning Tickets.");
}

window.openAdminCodeModal=openAdminCodeModal;
window.closeAdminCodeModal=closeAdminCodeModal;
window.submitAdminCode=submitAdminCode;
window.closeAdminPanel=closeAdminPanel;
window.adminInfiniteBiomass=adminInfiniteBiomass;
window.adminInfiniteMaterials=adminInfiniteMaterials;
window.adminInfiniteSummonTickets=adminInfiniteSummonTickets;
window.adminUnlockBestiary=adminUnlockBestiary;
window.adminInfiniteSlots=adminInfiniteSlots;
window.adminGiveTicket=adminGiveTicket;
