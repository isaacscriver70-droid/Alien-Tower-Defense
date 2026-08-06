// =======================================================================
// SHARED SETTINGS/THEME HELPERS — depends on shared/data.js (AREAS).
// =======================================================================
let flashyLevel=100;
let flashyMode=true;
function applyFlashyLevel(level){
  flashyLevel=Math.max(0,Math.min(100,parseInt(level,10)||0));
  flashyMode=flashyLevel>=50;
}
function flashyMul(){ return Math.max(0.12,flashyLevel/100); }

function hexToRgbString(hex){
  hex=(hex||"#39ff14").replace('#','');
  if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  const num=parseInt(hex,16);
  return `${(num>>16)&255},${(num>>8)&255},${num&255}`;
}

// Applies an area/custom-slot palette to every .screen on the current
// page (each page only ever has one or two .screen elements, but this
// mirrors the original's "recolor everything visible" behavior).
function applyLobbyBackground(themeKey){
  const screens=document.querySelectorAll(".screen");
  let bg1="#18251b", bg2="#000", accent="#39ff14";
  if(themeKey && themeKey.startsWith("area")){
    const idx=parseInt(themeKey.replace("area",""),10);
    const area=AREAS[idx];
    if(area){ bg1=area.bg[0]; bg2=area.bg[1]; accent=area.accent; }
  }else if(themeKey && themeKey.startsWith("custom")){
    const idx=parseInt(themeKey.replace("custom",""),10);
    const slot=(metaData.settings && metaData.settings.customThemes || defaultCustomThemes())[idx];
    if(slot){ bg1=slot.bg1; bg2=slot.bg2; accent=slot.accent; }
  }
  screens.forEach(s=>{ s.style.background=`radial-gradient(circle,${bg1},${bg2})`; });
  document.documentElement.style.setProperty("--green",accent);
  document.documentElement.style.setProperty("--green-rgb",hexToRgbString(accent));
}

function lobbyMusicKeyFor(themeKey){
  if(themeKey && themeKey.startsWith("custom")){
    const idx=parseInt(themeKey.replace("custom",""),10);
    const slot=(metaData.settings.customThemes||defaultCustomThemes())[idx];
    return slot?slot.music:"menu";
  }
  return themeKey||"menu";
}

function populateLobbyThemeSelect(sel){
  if(!sel) return;
  sel.innerHTML="";
  const menuOpt=document.createElement("option");
  menuOpt.value="menu"; menuOpt.innerText="Default Menu Theme";
  sel.appendChild(menuOpt);
  AREAS.forEach((a,i)=>{
    const opt=document.createElement("option");
    opt.value="area"+i;
    opt.innerText="Area "+(i+1)+" - "+a.name;
    sel.appendChild(opt);
  });
  for(let i=0;i<3;i++){
    const opt=document.createElement("option");
    opt.value="custom"+i;
    opt.innerText="Custom Slot "+(i+1);
    sel.appendChild(opt);
  }
}
