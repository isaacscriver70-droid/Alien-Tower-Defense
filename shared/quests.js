// =======================================================================
// SHARED QUESTS — depends on shared/storage.js (metaData, saveToStorage)
// =======================================================================
const DAILY_QUEST_POOL=[
  {type:"kill",target:40,desc:"Kill 40 aliens",reward:{biomass:40}},
  {type:"wave",target:5,desc:"Clear 5 waves in one run",reward:{biomass:50}},
  {type:"build",target:5,desc:"Build 5 towers in one run",reward:{biomass:35}},
  {type:"crate",target:1,desc:"Open 1 crate (any kind)",reward:{tickets:1}},
  {type:"credits",target:300,desc:"Earn 300 credits from kills",reward:{biomass:45}},
  {type:"boss",target:1,desc:"Defeat 1 boss",reward:{biomass:60}}
];
const WEEKLY_QUEST_POOL=[
  {type:"wave",target:30,desc:"Reach wave 30 in a single run",reward:{biomass:300,tickets:5}},
  {type:"kill",target:400,desc:"Kill 400 aliens this week",reward:{biomass:350,tickets:5}},
  {type:"boss",target:3,desc:"Defeat 3 bosses this week",reward:{biomass:320,tickets:6}}
];

function todayKey(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function weekKey(){
  const d=new Date();
  const onejan=new Date(d.getFullYear(),0,1);
  const week=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7);
  return d.getFullYear()+"-W"+week;
}
function pickRandomDistinct(pool,count){
  const copy=[...pool];
  const picked=[];
  for(let i=0;i<count && copy.length>0;i++){
    const idx=Math.floor(Math.random()*copy.length);
    picked.push(copy.splice(idx,1)[0]);
  }
  return picked;
}
function ensureQuestsFresh(){
  const tKey=todayKey(), wKey=weekKey();
  if(!metaData.quests) metaData.quests={};
  if(metaData.quests.dayKey!==tKey){
    metaData.quests.dayKey=tKey;
    metaData.quests.daily=pickRandomDistinct(DAILY_QUEST_POOL,3).map(q=>({...q,progress:0,claimed:false}));
  }
  if(metaData.quests.weekKey!==wKey){
    metaData.quests.weekKey=wKey;
    metaData.quests.weekly=pickRandomDistinct(WEEKLY_QUEST_POOL,1).map(q=>({...q,progress:0,claimed:false}));
  }
  saveToStorage(metaData);
}
function questNotifyProgress(type,amount){
  if(!metaData.quests) return;
  const peakTypes=["wave"];
  const isPeak=peakTypes.includes(type);
  [metaData.quests.daily||[],metaData.quests.weekly||[]].forEach(list=>{
    list.forEach(q=>{
      if(q.type!==type || q.claimed) return;
      q.progress=isPeak?Math.max(q.progress,amount):Math.min(q.target,q.progress+amount);
    });
  });
  saveToStorage(metaData);
}
function rewardText(reward){
  const parts=[];
  if(reward.biomass) parts.push(`<span style="color:var(--gold)">${reward.biomass} Biomass</span>`);
  if(reward.tickets) parts.push(`<span style="color:#ff6a2b">${reward.tickets} Summoning Tickets</span>`);
  return parts.join(" + ");
}
