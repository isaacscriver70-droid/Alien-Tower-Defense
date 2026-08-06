// =======================================================================
// BESTIARY PAGE LOGIC
// =======================================================================
const AREA_FX={
  hacker:    {anim:"fxFall",  color:"#39ff14", glyph:"1", count:14, dur:[4,8]},
  volcano:   {anim:"fxRise",  color:"#ff6a00", glyph:"&#9679;", count:12, dur:[3,6]},
  arctic:    {anim:"fxFall",  color:"#dff6ff", glyph:"&#10052;", count:16, dur:[5,10]},
  desert:    {anim:"fxDrift", color:"#ffcf6b", glyph:"&#8901;", count:12, dur:[4,8]},
  space:     {anim:"fxTwinkle",color:"#ffffff",glyph:"&#8226;", count:18, dur:[2,4]},
  swamp:     {anim:"fxRise",  color:"#8aff33", glyph:"&#9675;", count:10, dur:[4,7]},
  cyberpunk: {anim:"fxDrift", color:"#ff2fd0", glyph:"&#9608;", count:10, dur:[3,6]},
  graveyard: {anim:"fxDrift", color:"#b7ffcf", glyph:"&#9729;", count:8,  dur:[6,10]},
  underwater:{anim:"fxRise",  color:"#33bbff", glyph:"&#9675;", count:14, dur:[4,8]},
  hive:      {anim:"fxTwinkle",color:"#ff1155",glyph:"&#9679;", count:12, dur:[2,5]}
};
function createAreaFxLayer(theme){
  const fx=AREA_FX[theme];
  const layer=document.createElement("div");
  layer.className="area-fx-layer";
  if(!fx) return layer;
  for(let i=0;i<fx.count;i++){
    const p=document.createElement("span");
    p.className="area-fx-particle";
    const dur=(fx.dur[0]+Math.random()*(fx.dur[1]-fx.dur[0])).toFixed(2);
    p.style.left=(Math.random()*100)+"%";
    p.style.top=(Math.random()*100)+"%";
    p.style.color=fx.color;
    p.style.animationName=fx.anim;
    p.style.animationDuration=dur+"s";
    p.style.animationDelay=(-Math.random()*dur)+"s";
    p.innerHTML=fx.glyph;
    layer.appendChild(p);
  }
  return layer;
}

function createBeastCard(type,unlocked,areaTag,themeOverride){
  const base=ENEMY_TYPES[type]||{};
  const card=document.createElement("div");
  if(!unlocked){
    card.className="beast-card locked";
    card.innerHTML=`
      <div class="beast-locked-icon">?</div>
      <div class="beast-name">REDACTED</div>
      <div class="beast-stats">Encounter this class in the field to unlock its entry.</div>
    `;
    return card;
  }
  card.className="beast-card unlocked";
  card.style.setProperty("--bcolor",base.color);
  card.innerHTML=`
    <div style="height:80px;border-radius:8px;background:radial-gradient(circle,${base.color}33,#00000055);display:flex;align-items:center;justify-content:center;">
      <canvas class="beast-icon-canvas" width="72" height="72"></canvas>
    </div>
    <div class="beast-name">${base.name}</div>
    <div class="beast-stats">HP ${base.hp} &nbsp;&middot;&nbsp; SPD ${base.speed} &nbsp;&middot;&nbsp; BOUNTY ${base.reward}</div>
    <div class="beast-desc">${BEAST_DESC[type]||""}</div>
    ${areaTag?`<div class="beast-area-tag">${areaTag}</div>`:""}
  `;
  const cv=card.querySelector(".beast-icon-canvas");
  const iconOpts={theme:themeOverride,color:base.color};
  renderAlienIcon(cv,type,iconOpts);
  registerBestiaryIcon(cv,type,iconOpts);
  return card;
}

function buildBestiary(){
  bestiaryIconRegistry=[];
  const dTypes=metaData.discoveredTypes||[];
  const dBosses=metaData.discoveredBosses||[];
  document.getElementById("bestiary-progress").innerText=
    `${dTypes.length} / ${BEAST_ORDER.length} classes logged  \u00b7  ${dBosses.length} / ${AREAS.length} bosses logged`;

  const rosterEl=document.getElementById("bestiary-roster");
  rosterEl.innerHTML="";

  const recurringGroup=document.createElement("div");
  recurringGroup.className="bestiary-area-group";
  recurringGroup.innerHTML=`<div class="bestiary-area-label" style="--gcolor:var(--purple);color:var(--purple);">RECURRING CLASSES &middot; found everywhere</div>
    <div class="bestiary-roster-grid" id="bestiary-recurring"></div>`;
  rosterEl.appendChild(recurringGroup);
  const recurringGrid=recurringGroup.querySelector("#bestiary-recurring");
  RECURRING_TYPES.forEach(type=>{
    recurringGrid.appendChild(createBeastCard(type,dTypes.includes(type),null));
  });

  AREAS.forEach((area,i)=>{
    const trio=AREA_EXCLUSIVE_TYPES[i];
    if(!trio) return;
    const group=document.createElement("div");
    group.className="bestiary-area-group";
    if(flashyMode) group.appendChild(createAreaFxLayer(area.theme));
    group.insertAdjacentHTML("beforeend",
      `<div class="bestiary-area-label" style="--gcolor:${area.accent};color:${area.accent};">${String(i+1).padStart(2,'0')} &middot; ${area.name}</div>
       <div class="bestiary-roster-grid"></div>
       <button class="area-skin-toggle" onclick="this.nextElementSibling.classList.toggle('open')">How aliens look here &#9662;</button>
       <div class="area-skin-grid"></div>`);
    rosterEl.appendChild(group);
    const grid=group.querySelector(".bestiary-roster-grid");
    trio.forEach(type=>{
      grid.appendChild(createBeastCard(type,dTypes.includes(type),area.name));
    });
    const skinGrid=group.querySelector(".area-skin-grid");
    RECURRING_TYPES.forEach(type=>{
      const base=ENEMY_TYPES[type];
      const wrap=document.createElement("div");
      wrap.className="area-skin-card";
      wrap.innerHTML=`<canvas class="beast-icon-canvas" width="54" height="54"></canvas><div>${base.name}</div>`;
      const cv=wrap.querySelector("canvas");
      const iconOpts={theme:area.theme,color:base.color,size:16};
      renderAlienIcon(cv,type,iconOpts);
      registerBestiaryIcon(cv,type,iconOpts);
      skinGrid.appendChild(wrap);
    });
  });

  const impostorGroup=document.createElement("div");
  impostorGroup.className="bestiary-area-group";
  impostorGroup.innerHTML=`<div class="bestiary-area-label" style="--gcolor:var(--red);color:var(--red);">??? &middot; ANYWHERE</div>
    <div class="bestiary-roster-grid"></div>`;
  rosterEl.appendChild(impostorGroup);
  impostorGroup.querySelector(".bestiary-roster-grid").appendChild(
    createBeastCard("impostor",dTypes.includes("impostor"),null));

  const bossesEl=document.getElementById("bestiary-bosses");
  bossesEl.innerHTML="";
  AREAS.forEach((area,i)=>{
    const unlocked=dBosses.includes(i);
    const entry=document.createElement("div");
    entry.className="boss-entry"+(unlocked?" unlocked":"");
    if(unlocked) entry.style.setProperty("--bcolor",area.boss.color);
    entry.innerHTML=`
      <div class="boss-entry-head">
        <div class="boss-num">${String(i+1).padStart(2,'0')}</div>
        <div class="boss-entry-title">${unlocked?area.boss.name:"??? \u2014 "+area.name}</div>
      </div>
      <div class="boss-entry-body"><div class="boss-entry-inner">
        <div style="width:130px;height:130px;flex:0 0 130px;border-radius:10px;background:radial-gradient(circle,${unlocked?area.boss.color+'33':'#111'},#000);display:flex;align-items:center;justify-content:center;">
          ${unlocked?'<canvas class="boss-icon-canvas" width="110" height="110"></canvas>':'<span style="font-size:2.5rem;">?</span>'}
        </div>
        <div>
          <div class="beast-stats">Sector: ${area.name} &middot; Waves ${i*10+1}\u2013${(i+1)*10}</div>
          <div class="beast-desc">${unlocked?"A unique boss-tier alien found at the end of "+area.name+".":"Reach wave "+(i*10+1)+" to encounter this boss."}</div>
        </div>
      </div></div>`;
    entry.querySelector(".boss-entry-head").addEventListener("click",()=>entry.classList.toggle("open"));
    if(unlocked){
      const cv=entry.querySelector(".boss-icon-canvas");
      const iconOpts={theme:area.theme,color:area.boss.color,size:26};
      renderAlienIcon(cv,"boss",iconOpts);
      registerBestiaryIcon(cv,"boss",iconOpts);
    }
    bossesEl.appendChild(entry);
  });
}

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme||"menu"));
  buildBestiary();
  startBestiaryAnimation();
});
window.addEventListener("beforeunload",stopBestiaryAnimation);
