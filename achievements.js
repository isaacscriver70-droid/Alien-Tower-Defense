// =======================================================================
// ACHIEVEMENTS PAGE LOGIC
// =======================================================================
function buildAchievementCategory(key,label,targets,rewardFn,statFn,icon){
  return targets.map((target,i)=>({
    id:key+"_"+i,
    label,
    icon,
    desc:label+" "+target,
    target,
    reward:rewardFn(target,i),
    statFn
  }));
}
let ACHIEVEMENTS=[];
function buildAchievementsList(){
  ACHIEVEMENTS=[
    ...buildAchievementCategory("wave","Reach Wave",[5,10,15,20,25,30,40,50,60,80],
      (t)=>({biomass:t*10}), ()=>metaData.bestWave||0, "&#9889;"),
    ...buildAchievementCategory("kills","Harvest",[50,150,300,600,1000,2000,3500,5500,8000,12000],
      (t)=>({biomass:Math.round(t*0.6)}), ()=>(metaData.stats&&metaData.stats.totalKills)||0, "&#128126;"),
    ...buildAchievementCategory("areas","Clear",[1,2,3,4,5,6,7,8,9,10],
      (t)=>({tickets:t*2}), ()=>metaData.areasEverCleared||0, "&#127758;"),
    ...buildAchievementCategory("crates","Open",[1,5,15,30,60],
      (t)=>({biomass:t*15}), ()=>((metaData.stats&&metaData.stats.cratesOpened)||0)+((metaData.stats&&metaData.stats.armorCratesOpened)||0)+((metaData.stats&&metaData.stats.towerCratesOpened)||0), "&#127183;"),
    ...buildAchievementCategory("bosses","Defeat",[1,3,6,10,15],
      (t)=>({tickets:t*3}), ()=>(metaData.stats&&metaData.stats.bossesKilled)||0, "&#128128;"),
    ...buildAchievementCategory("towers","Own",[3,6,10,15,20],
      (t)=>({biomass:t*25}), ()=>(metaData.ownedTowers||[]).length, "&#127981;"),
    ...buildAchievementCategory("materials","Collect",[10,50,150,400,1000],
      (t)=>({biomass:Math.round(t*1.2)}), ()=>(metaData.stats&&metaData.stats.materialsCollectedTotal)||0, "&#128142;")
  ];
  const ACH_SUFFIX={wave:"waves reached","kills":"aliens harvested",areas:"areas cleared",crates:"crates opened",bosses:"bosses defeated",towers:"towers owned",materials:"materials collected"};
  ACHIEVEMENTS.forEach(a=>{
    const cat=a.id.split("_")[0];
    a.desc=a.label+" "+a.target+" ("+ACH_SUFFIX[cat]+")";
  });
}

function renderAchievements(){
  const claimed=metaData.achievementsClaimed||[];
  let doneCount=0;
  const html=ACHIEVEMENTS.map(a=>{
    const progress=a.statFn();
    const complete=progress>=a.target;
    const isClaimed=claimed.includes(a.id);
    if(complete) doneCount++;
    const pct=Math.min(100,Math.round((progress/a.target)*100));
    return `<div class="ach-card${isClaimed?' done':''}">
      <div class="ach-title">${a.icon} ${a.desc}</div>
      <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pct}%;"></div></div>
      <div style="font-family:Arial;font-size:.72rem;color:#999;margin-top:4px;">${Math.min(progress,a.target)} / ${a.target}</div>
      <div class="ach-reward">Reward: ${rewardText(a.reward)}</div>
      ${isClaimed?'<div style="color:var(--green);font-size:.78rem;margin-top:6px;">&#10003; CLAIMED</div>':
        (complete?`<button style="margin-top:8px;padding:.4em .9em;font-size:.8rem;min-height:32px;" onclick="claimAchievement('${a.id}')">CLAIM</button>`:'')}
    </div>`;
  }).join("");
  document.getElementById("ach-list").innerHTML=html;
  document.getElementById("ach-progress").innerText=`${doneCount} / ${ACHIEVEMENTS.length} achievements unlocked`;
}
function claimAchievement(id){
  const a=ACHIEVEMENTS.find(x=>x.id===id);
  if(!a) return;
  metaData.achievementsClaimed=metaData.achievementsClaimed||[];
  if(metaData.achievementsClaimed.includes(id)) return;
  if(a.statFn()<a.target){ playSound("denied"); return; }
  metaData.achievementsClaimed.push(id);
  if(a.reward.biomass) metaData.biomass=(metaData.biomass||0)+a.reward.biomass;
  if(a.reward.tickets) metaData.summonTickets=(metaData.summonTickets||0)+a.reward.tickets;
  saveToStorage(metaData);
  playSound("winRare");
  renderAchievements();
}
window.claimAchievement=claimAchievement;

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  buildAchievementsList();
  renderAchievements();
});
