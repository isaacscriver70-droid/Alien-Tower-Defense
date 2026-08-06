// =======================================================================
// LEADERBOARD PAGE LOGIC
// =======================================================================
let leaderboardTab="wave";
function setLeaderboardTab(tab){
  leaderboardTab=tab;
  ["wave","kills","records"].forEach(t=>{
    const btn=document.getElementById("lb-tab-"+t);
    if(btn) btn.classList.toggle("active",t===tab);
  });
  renderLeaderboard();
  playSound("click");
}
window.setLeaderboardTab=setLeaderboardTab;

function renderLeaderboard(){
  const el=document.getElementById("leaderboard-content");
  const history=metaData.runHistory||[];
  if(leaderboardTab==="records"){
    const s=metaData.stats||{};
    el.innerHTML=`
      <div class="ach-card"><div class="ach-title">Highest Wave Ever</div><div class="ach-desc">${metaData.bestWave||0}</div></div>
      <div class="ach-card"><div class="ach-title">Total Aliens Harvested</div><div class="ach-desc">${s.totalKills||0}</div></div>
      <div class="ach-card"><div class="ach-title">Bosses Defeated</div><div class="ach-desc">${s.bossesKilled||0}</div></div>
      <div class="ach-card"><div class="ach-title">Areas Cleared (best run)</div><div class="ach-desc">${metaData.areasEverCleared||0} / ${AREAS.length}</div></div>
      <div class="ach-card"><div class="ach-title">Crates Opened</div><div class="ach-desc">${(s.cratesOpened||0)+(s.armorCratesOpened||0)+(s.towerCratesOpened||0)}</div></div>
      <div class="ach-card"><div class="ach-title">Towers Built (lifetime)</div><div class="ach-desc">${s.towersBuilt||0}</div></div>`;
    return;
  }
  const sortKey=leaderboardTab==="wave"?"wave":"kills";
  const rows=[...history].sort((a,b)=>b[sortKey]-a[sortKey]).slice(0,10);
  if(rows.length===0){
    el.innerHTML=`<div style="color:#666;">No completed runs logged yet - finish a mission to appear here.</div>`;
    return;
  }
  el.innerHTML=rows.map((r,i)=>`
    <div class="ach-card">
      <div class="ach-title">#${i+1} - ${escapeHtml(r.name||"Commander")} - Wave ${r.wave} &middot; ${r.kills} kills</div>
      <div class="ach-desc">${(MODES[r.mode]&&MODES[r.mode].name)||r.mode} &middot; ${new Date(r.date).toLocaleDateString()}</div>
    </div>`).join("");
}

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme||"menu"));
  renderLeaderboard();
});
