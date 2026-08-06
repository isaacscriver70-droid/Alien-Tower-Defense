// =======================================================================
// QUESTS PAGE LOGIC
// =======================================================================
function questCardHtml(q,idx,kind){
  const complete=q.progress>=q.target;
  return `<div class="quest-card${q.claimed?' done':''}">
    <div class="quest-title">${q.desc}</div>
    <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${Math.min(100,Math.round(q.progress/q.target*100))}%;"></div></div>
    <div style="font-family:Arial;font-size:.72rem;color:#999;margin-top:4px;">${Math.min(q.progress,q.target)} / ${q.target}</div>
    <div class="quest-reward">Reward: ${rewardText(q.reward)}</div>
    ${q.claimed?'<div style="color:var(--green);font-size:.78rem;margin-top:6px;">&#10003; CLAIMED</div>':
      (complete?`<button style="margin-top:8px;padding:.4em .9em;font-size:.8rem;min-height:32px;" onclick="claimQuest('${kind}',${idx})">CLAIM</button>`:'')}
  </div>`;
}
function renderQuests(){
  const daily=(metaData.quests&&metaData.quests.daily)||[];
  const weekly=(metaData.quests&&metaData.quests.weekly)||[];
  document.getElementById("daily-quest-list").innerHTML=daily.map((q,i)=>questCardHtml(q,i,"daily")).join("")||"<div style='color:#888;'>No daily quests.</div>";
  document.getElementById("weekly-quest-list").innerHTML=weekly.map((q,i)=>questCardHtml(q,i,"weekly")).join("")||"<div style='color:#888;'>No weekly quest.</div>";
}
function claimQuest(kind,idx){
  const list=kind==="daily"?metaData.quests.daily:metaData.quests.weekly;
  const q=list[idx];
  if(!q || q.claimed || q.progress<q.target) return;
  q.claimed=true;
  if(q.reward.biomass) metaData.biomass=(metaData.biomass||0)+q.reward.biomass;
  if(q.reward.tickets) metaData.summonTickets=(metaData.summonTickets||0)+q.reward.tickets;
  saveToStorage(metaData);
  playSound("winRare");
  renderQuests();
}
window.claimQuest=claimQuest;

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme||"menu"));
  ensureQuestsFresh();
  renderQuests();
});
