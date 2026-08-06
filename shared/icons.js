// =======================================================================
// SHARED ALIEN RENDERING — used by the Bestiary, reward/discovery
// popups, and the live game canvas. Depends on shared/data.js
// (ENEMY_TYPES) and shared/settings.js (flashyMode/flashyMul).
//
// Refactored from the original single-file version: every draw function
// now takes `ctx` as an explicit first argument instead of relying on a
// swapped module-global `ctx` variable. That trick only worked because
// everything shared one script/one canvas; across separate pages each
// page has its own canvas context, so passing ctx explicitly is what
// makes this module safely reusable everywhere.
// =======================================================================
let discoBallOn=false;
function setDiscoBall(v){ discoBallOn=!!v; }

const CANNON_BITMAP=[
  [0,0,0,1,0,0,0],
  [0,0,1,1,1,0,0],
  [0,0,1,1,1,0,0],
  [1,1,1,1,1,1,1]
];
const INVADER_FRAME_A=[
  [0,0,1,0,0,1,0,0],
  [0,0,0,1,1,0,0,0],
  [0,1,1,1,1,1,1,0],
  [1,1,0,1,1,0,1,1],
  [1,1,1,1,1,1,1,1],
  [1,0,1,0,0,1,0,1],
  [0,1,0,0,0,0,1,0]
];
const INVADER_FRAME_B=[
  [0,0,1,0,0,1,0,0],
  [1,0,0,1,1,0,0,1],
  [1,1,1,1,1,1,1,1],
  [1,1,0,1,1,0,1,1],
  [0,1,1,1,1,1,1,0],
  [0,0,1,0,0,1,0,0],
  [0,1,0,0,0,0,1,0]
];

function drawPixelSprite(ctx,bitmap,size,color){
  const rows=bitmap.length, cols=bitmap[0].length;
  const px=size/cols;
  ctx.fillStyle=color;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      if(bitmap[r][c]) ctx.fillRect((c-cols/2)*px,(r-rows/2)*px,px+0.6,px+0.6);
    }
  }
}

function drawTowerBarrel(ctx,t){
  if(!flashyMode){ drawPixelSprite(ctx,CANNON_BITMAP,30,t.color); return; }
  const c=t.color, fm=flashyMul(), now=performance.now();
  function glow(amt){ ctx.shadowBlur=amt*fm; ctx.shadowColor=c; }
  switch(t.type){
    case "acid":
      ctx.fillStyle=c; ctx.fillRect(0,-6,18,4); ctx.fillRect(0,2,18,4);
      glow(8); ctx.beginPath(); ctx.arc(18,-4,2.5,0,Math.PI*2); ctx.arc(18,4,2.5,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      break;
    case "super":
      glow(18); ctx.fillStyle=c; ctx.beginPath(); ctx.arc(6,0,9,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.strokeStyle=c; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(6,0,13,now/300,now/300+4); ctx.stroke();
      break;
    case "freeze":
      ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(6,-9); ctx.lineTo(-4,0); ctx.lineTo(6,9); ctx.closePath(); ctx.fill();
      glow(10); ctx.strokeStyle=c; ctx.lineWidth=1.5;
      for(let i=0;i<4;i++){ const a=i*Math.PI/2; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(6+Math.cos(a)*11,Math.sin(a)*11); ctx.stroke(); }
      ctx.shadowBlur=0;
      break;
    case "sniper":
      ctx.fillStyle=c; ctx.fillRect(0,-2,32,4);
      ctx.beginPath(); ctx.arc(12,0,4,0,Math.PI*2); ctx.strokeStyle=c; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle="#222"; ctx.fillRect(2,-6,6,3); ctx.fillRect(2,3,6,3);
      break;
    case "tesla":
      ctx.strokeStyle=c; ctx.lineWidth=2; glow(12);
      for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(4+i*4,0,4-i*0.7,0,Math.PI*2); ctx.stroke(); }
      ctx.shadowBlur=0;
      break;
    case "missile":
      ctx.fillStyle="#333"; ctx.fillRect(-2,-9,12,18);
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(4,-9,3,0,Math.PI*2); ctx.arc(4,9,3,0,Math.PI*2); ctx.fill();
      break;
    case "railgun":
      ctx.strokeStyle=c; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(28,-6); ctx.moveTo(0,6); ctx.lineTo(28,6); ctx.stroke();
      if(Math.random()<0.5*fm){ ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(10,-6); ctx.lineTo(14,6); ctx.lineTo(20,-4); ctx.stroke(); }
      break;
    case "flame":
      ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(-4,-8); ctx.lineTo(16,0); ctx.lineTo(-4,8); ctx.closePath();
      glow(10); ctx.fill(); ctx.shadowBlur=0;
      break;
    case "vortex":
      ctx.strokeStyle=c; ctx.lineWidth=1.5;
      for(let r=0;r<3;r++){ ctx.globalAlpha=0.7-r*0.2; ctx.beginPath(); ctx.arc(0,0,5+r*4,now/200+r,now/200+r+4); ctx.stroke(); }
      ctx.globalAlpha=1;
      break;
    case "poison":
      ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(-3,-8); ctx.lineTo(10,-3); ctx.lineTo(10,3); ctx.lineTo(-3,8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(10,0,3,0,Math.PI*2); ctx.fill();
      break;
    case "emp":
      ctx.strokeStyle=c; ctx.lineWidth=2; glow(10);
      for(let r=0;r<2;r++){ ctx.beginPath(); ctx.arc(0,0,6+r*6,0,Math.PI*2); ctx.globalAlpha=0.7-r*0.3; ctx.stroke(); }
      ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.fillStyle=c; ctx.fillRect(-3,-3,6,6);
      break;
    case "hijack":
      ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(2,0,11,7,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(2,0,3.5,0,Math.PI*2); ctx.fillStyle="#000"; ctx.fill();
      break;
    case "blackhole":
      glow(14);
      for(let r=0;r<3;r++){ ctx.beginPath(); ctx.arc(0,0,5+r*4.5,0,Math.PI*2); ctx.strokeStyle=c; ctx.lineWidth=2; ctx.globalAlpha=0.55-r*0.15; ctx.stroke(); }
      ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fillStyle="#000"; ctx.fill();
      break;
    case "hacktower":
      ctx.fillStyle=c; ctx.fillRect(-6,-6,16,12);
      ctx.fillStyle="#000";
      for(let i=0;i<2;i++) for(let j=0;j<2;j++) ctx.fillRect(-4+i*8,-4+j*8,3,3);
      break;
    case "magmacannon":
      ctx.fillStyle="#332015"; ctx.fillRect(0,-7,22,14);
      glow(12); ctx.fillStyle=c; ctx.beginPath(); ctx.arc(22,0,4,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      break;
    case "frostlance":
      ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(30,0); ctx.lineTo(6,-4); ctx.lineTo(6,4); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=0.5; ctx.fillRect(-2,-2,10,4); ctx.globalAlpha=1;
      break;
    case "sandreaper":
      ctx.strokeStyle=c; ctx.lineWidth=2.5;
      for(let i=0;i<3;i++){ const a=now/100+i*(Math.PI*2/3); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14); ctx.stroke(); }
      break;
    case "voidray":
      glow(14); ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(22,0); ctx.lineTo(0,6); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
      break;
    case "swampmaw":
      ctx.fillStyle=c;
      ctx.beginPath(); ctx.moveTo(-2,-9); ctx.lineTo(14,-2); ctx.lineTo(-2,0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2,9); ctx.lineTo(14,2); ctx.lineTo(-2,0); ctx.closePath(); ctx.fill();
      break;
    case "neonblade":
      ctx.strokeStyle=c; ctx.lineWidth=2; glow(10);
      for(let i=0;i<4;i++){ const a=i*Math.PI/2+now/150; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*13,Math.sin(a)*13); ctx.stroke(); }
      ctx.shadowBlur=0;
      break;
    case "phantomtrap":
      ctx.strokeStyle=c; ctx.lineWidth=2; ctx.globalAlpha=0.7+0.3*Math.sin(now/200);
      ctx.beginPath(); ctx.arc(6,0,10,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
      break;
    case "krakenharpoon":
      ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(30,0); ctx.lineTo(10,-6); ctx.lineTo(14,0); ctx.lineTo(10,6); ctx.closePath(); ctx.fill();
      ctx.fillRect(-2,-3,12,6);
      break;
    case "hivespike":
      ctx.fillStyle=c;
      for(let i=0;i<3;i++){ const a=-0.5+i*0.5; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*16,Math.sin(a)*16-4); ctx.lineTo(Math.cos(a)*16,Math.sin(a)*16+4); ctx.closePath(); ctx.fill(); }
      break;
    case "omega":{
      const pulse=(Math.sin(now/150)+1)/2;
      ctx.beginPath(); ctx.arc(0,0,14+pulse*6,0,Math.PI*2);
      ctx.strokeStyle=`hsl(${(now/8)%360},100%,65%)`; ctx.lineWidth=4;
      glow(20); ctx.stroke(); ctx.shadowBlur=0;
      break;}
    case "secretop":
      glow(16); ctx.fillStyle=c;
      ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(10,0); ctx.lineTo(0,10); ctx.lineTo(-10,0); ctx.closePath(); ctx.fill();
      ctx.shadowBlur=0;
      break;
    default:
      ctx.fillStyle=c; ctx.fillRect(0,-4,20,8);
  }
}

const TYPE_SHAPE={
  normal:{bw:1,bh:1,legs:3,eyes:2,spikes:0,segmented:false,lean:false},
  runner:{bw:0.75,bh:1.25,legs:3,eyes:2,spikes:0,segmented:false,lean:true},
  stunner:{bw:1.05,bh:1.0,legs:4,eyes:3,spikes:3,segmented:false,lean:false},
  tank:{bw:1.3,bh:1.05,legs:4,eyes:2,spikes:2,segmented:false,lean:false},
  shielded:{bw:1.1,bh:1.05,legs:4,eyes:1,spikes:0,segmented:false,lean:false},
  splitter:{bw:1.0,bh:1.0,legs:4,eyes:2,spikes:0,segmented:true,lean:false},
  splitling:{bw:0.9,bh:0.9,legs:3,eyes:2,spikes:0,segmented:false,lean:false},
  cloaked:{bw:0.85,bh:1.15,legs:2,eyes:2,spikes:0,segmented:false,lean:false},
  juggernaut:{bw:1.4,bh:1.15,legs:5,eyes:2,spikes:4,segmented:false,lean:false},
  boss:{bw:1.4,bh:1.2,legs:5,eyes:3,spikes:5,segmented:false,lean:false},
  glitch:{bw:0.8,bh:1.1,legs:3,eyes:2,spikes:0,segmented:false,lean:true},
  cinder:{bw:1.15,bh:0.95,legs:4,eyes:2,spikes:2,segmented:false,lean:false},
  frostfang:{bw:0.8,bh:1.2,legs:3,eyes:2,spikes:1,segmented:false,lean:true},
  burrower:{bw:1.35,bh:0.9,legs:6,eyes:2,spikes:0,segmented:false,lean:false},
  drifter:{bw:0.9,bh:0.9,legs:2,eyes:3,spikes:0,segmented:false,lean:true},
  leech:{bw:1.0,bh:1.0,legs:0,eyes:2,spikes:0,segmented:true,lean:false},
  leechling:{bw:0.85,bh:0.85,legs:0,eyes:2,spikes:0,segmented:false,lean:false},
  wraith:{bw:0.9,bh:1.15,legs:2,eyes:2,spikes:0,segmented:false,lean:false},
  specter:{bw:0.95,bh:1.2,legs:0,eyes:2,spikes:0,segmented:false,lean:false},
  angler:{bw:1.1,bh:1.0,legs:4,eyes:1,spikes:1,segmented:false,lean:false},
  broodling:{bw:1.3,bh:1.1,legs:6,eyes:3,spikes:3,segmented:true,lean:false},
  broodletling:{bw:0.85,bh:0.85,legs:3,eyes:2,spikes:0,segmented:false,lean:false},
  impostor:{bw:0.95,bh:1.15,legs:0,eyes:2,spikes:0,segmented:false,lean:false},
  daemon:{bw:0.75,bh:1.25,legs:3,eyes:2,spikes:0,segmented:false,lean:true},
  trojan:{bw:1.3,bh:1.05,legs:4,eyes:2,spikes:2,segmented:false,lean:false},
  ashling:{bw:0.75,bh:1.25,legs:3,eyes:2,spikes:0,segmented:false,lean:true},
  obsidianite:{bw:1.3,bh:1.05,legs:4,eyes:2,spikes:2,segmented:false,lean:false},
  icewraith:{bw:0.85,bh:1.15,legs:2,eyes:2,spikes:0,segmented:false,lean:false},
  glacierback:{bw:1.3,bh:1.05,legs:4,eyes:2,spikes:2,segmented:false,lean:false},
  scarab:{bw:1.0,bh:1.0,legs:4,eyes:2,spikes:0,segmented:true,lean:false},
  mirage:{bw:0.85,bh:1.15,legs:2,eyes:2,spikes:0,segmented:false,lean:false},
  meteorhusk:{bw:1.3,bh:1.05,legs:4,eyes:2,spikes:2,segmented:false,lean:false},
  nebulamoth:{bw:0.85,bh:1.15,legs:2,eyes:2,spikes:0,segmented:false,lean:false},
  sporeling:{bw:0.75,bh:1.25,legs:3,eyes:2,spikes:0,segmented:false,lean:true},
  bogcrawler:{bw:1.3,bh:1.05,legs:4,eyes:2,spikes:2,segmented:false,lean:false},
  circuitbreaker:{bw:1.05,bh:1.0,legs:4,eyes:3,spikes:3,segmented:false,lean:false},
  hologram:{bw:0.85,bh:1.15,legs:2,eyes:2,spikes:0,segmented:false,lean:false},
  ghoul:{bw:1.3,bh:1.05,legs:4,eyes:2,spikes:2,segmented:false,lean:false},
  banshee:{bw:0.85,bh:1.15,legs:2,eyes:2,spikes:0,segmented:false,lean:false},
  jellydrifter:{bw:0.75,bh:1.25,legs:3,eyes:2,spikes:0,segmented:false,lean:true},
  deepcrawler:{bw:0.85,bh:1.15,legs:2,eyes:2,spikes:0,segmented:false,lean:false},
  hivelarva:{bw:0.85,bh:0.85,legs:3,eyes:2,spikes:0,segmented:false,lean:false},
  hiveguardian:{bw:1.3,bh:1.05,legs:4,eyes:2,spikes:2,segmented:false,lean:false}
};

function lightenColor(hex,percent){
  hex=hex.replace('#','');
  if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  const num=parseInt(hex,16);
  let r=(num>>16)+percent, g=((num>>8)&0x00FF)+percent, b=(num&0x0000FF)+percent;
  r=Math.min(255,Math.max(0,r)); g=Math.min(255,Math.max(0,g)); b=Math.min(255,Math.max(0,b));
  return "#"+(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function drawAreaThemeDecor(ctx,e,theme,s,bw,bh,t){
  if(theme==="arctic"){
    ctx.beginPath(); ctx.ellipse(0,-s*0.95*bh,s*0.55*bw,s*0.28,0,Math.PI,0,true);
    ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.5)";
    for(let i=0;i<3;i++){ const a=t*2+i*2; ctx.beginPath(); ctx.arc(Math.cos(a)*s*0.9,-s*0.3+Math.sin(a)*s*0.3,1.4,0,Math.PI*2); ctx.fill(); }
  }else if(theme==="volcano"){
    const glow=0.5+0.5*Math.sin(t*4+e.x*0.08);
    ctx.save(); ctx.globalCompositeOperation="lighter";
    ctx.fillStyle=`rgba(255,${110+Math.floor(60*glow)},20,${0.16+0.1*glow})`;
    ctx.beginPath(); ctx.ellipse(0,s*0.1*bh,s*1.05*bw,s*1.05*bh,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    const cracks=[[[-s*0.42,-s*0.55],[-s*0.18,-s*0.15],[-s*0.32,s*0.35]],[[s*0.4,-s*0.5],[s*0.15,-s*0.05],[s*0.3,s*0.4]],[[-s*0.05,-s*0.75],[s*0.05,-s*0.3],[-s*0.1,s*0.15]],[[s*0.05,s*0.05],[-s*0.05,s*0.35],[s*0.1,s*0.7]]];
    ctx.lineWidth=Math.max(1.2,s*0.09); ctx.shadowBlur=6+glow*8; ctx.shadowColor="rgba(255,140,30,0.9)";
    ctx.strokeStyle=`rgba(255,${190+Math.floor(50*glow)},${60+Math.floor(60*glow)},${0.75+0.2*glow})`;
    for(const c of cracks){ ctx.beginPath(); ctx.moveTo(c[0][0],c[0][1]); for(let i=1;i<c.length;i++) ctx.lineTo(c[i][0],c[i][1]); ctx.stroke(); }
    ctx.shadowBlur=0;
  }else if(theme==="desert"){
    ctx.fillStyle="rgba(20,15,10,0.7)"; ctx.fillRect(-s*0.45*bw,-s*0.22*bh,s*0.9*bw,s*0.16);
    ctx.fillStyle="rgba(255,220,150,0.5)";
    ctx.beginPath(); ctx.moveTo(-s*0.5*bw,s*0.7*bh); ctx.lineTo(0,s*1.15*bh); ctx.lineTo(s*0.5*bw,s*0.7*bh); ctx.fill();
  }else if(theme==="space"){
    ctx.fillStyle="rgba(255,255,255,0.8)";
    for(let i=0;i<2;i++){ const a=t*3+i*3.1+e.x*0.05; ctx.beginPath(); ctx.arc(Math.sin(a)*s*1.1,-s*0.6+Math.cos(a)*s*0.4,1.3,0,Math.PI*2); ctx.fill(); }
  }else if(theme==="swamp"){
    ctx.strokeStyle="rgba(60,150,20,0.8)"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(-s*0.5*bw,0); ctx.quadraticCurveTo(0,s*0.35,s*0.5*bw,-s*0.05); ctx.stroke();
  }else if(theme==="cyberpunk"){
    ctx.fillStyle="rgba(255,47,208,0.55)"; ctx.fillRect(-s*0.32*bw,-s*0.2*bh,s*0.64*bw,s*0.09);
  }else if(theme==="graveyard"){
    ctx.fillStyle="rgba(180,190,200,0.25)";
    ctx.beginPath(); ctx.moveTo(-s*0.5*bw,-s*0.2*bh); ctx.lineTo(0,-s*1.05*bh); ctx.lineTo(s*0.5*bw,-s*0.2*bh); ctx.lineTo(0,s*0.15*bh); ctx.fill();
  }else if(theme==="underwater"){
    ctx.fillStyle="rgba(150,220,255,0.5)";
    for(let i=0;i<2;i++){ const yy=s*0.6-((t*30+i*20)%(s*1.8)); ctx.beginPath(); ctx.arc(s*0.5*bw,yy,1.6,0,Math.PI*2); ctx.fill(); }
  }else if(theme==="hive"){
    ctx.strokeStyle="rgba(255,17,85,0.5)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-s*0.3*bw,-s*0.05); ctx.lineTo(0,-s*0.35); ctx.lineTo(s*0.3*bw,-s*0.05); ctx.stroke();
  }else if(theme==="hacker"){
    ctx.fillStyle="rgba(57,255,20,0.55)"; ctx.fillRect(-s*0.3*bw,-s*0.18*bh,s*0.6*bw,s*0.06);
  }
}

function drawAlienBodyRetro(ctx,e){
  const s=e.size;
  ctx.save();
  ctx.translate(e.x,e.y);
  if(e.cloaked) ctx.globalAlpha=0.25;
  const bodyColor=e.slowTimer>0?"#5fd4ff":e.color;
  const frame=Math.floor(performance.now()/300)%2===0?INVADER_FRAME_A:INVADER_FRAME_B;
  drawPixelSprite(ctx,frame,s*2.3,bodyColor);
  if(e.type==="boss"){
    ctx.strokeStyle=bodyColor; ctx.lineWidth=2;
    ctx.strokeRect(-s*1.3,-s*1.3,s*2.6,s*2.6);
  }
  ctx.restore();
}

function drawAlienBodyFlashy(ctx,e,themeOverride){
  const shapeDef=TYPE_SHAPE[e.type]||TYPE_SHAPE.normal;
  const base=ENEMY_TYPES[e.type]||{};
  const isBig=(e.type==="boss"||!!base.heavy);
  const s=e.size;
  const t=performance.now()/1000+(e.bobSeed||0);
  const bob=Math.sin(t*3)*s*0.08*flashyMul();
  const cloakA=e.cloaked?0.25:1;

  ctx.save();
  ctx.translate(e.x,e.y+bob);
  ctx.globalAlpha=cloakA;

  const bodyColor=e.slowTimer>0?"#5fd4ff":e.color;
  const bw=shapeDef.bw*(isBig?1.15:1);
  const bh=shapeDef.bh;

  ctx.beginPath();
  ctx.ellipse(0,s*1.15,s*0.7*bw,s*0.22,0,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,0.35)";
  ctx.fill();

  ctx.strokeStyle=bodyColor;
  ctx.lineWidth=Math.max(1.4,s*0.14);
  ctx.globalAlpha=cloakA*0.75;
  for(let i=0;i<shapeDef.legs;i++){
    const lx=-s*0.55*bw+i*((s*1.1*bw)/((shapeDef.legs-1)||1));
    const wig=Math.sin(t*(shapeDef.lean?11:7)+i*1.6+e.x*0.1)*s*(shapeDef.lean?0.35:0.22);
    ctx.beginPath();
    ctx.moveTo(lx,s*0.5*bh);
    ctx.quadraticCurveTo(lx+wig,s*0.85*bh,lx+wig*0.6,s*1.15*bh);
    ctx.stroke();
  }
  ctx.globalAlpha=cloakA;

  if(shapeDef.segmented){
    for(const side of [-1,1]){
      ctx.beginPath();
      ctx.arc(side*s*0.85,s*0.15,s*0.35,0,Math.PI*2);
      ctx.fillStyle=bodyColor;
      ctx.globalAlpha=cloakA*0.85;
      ctx.fill();
      ctx.globalAlpha=cloakA;
    }
  }

  const glowColor=discoBallOn?`hsl(${(performance.now()/5+(e.bobSeed||0)*40)%360},100%,60%)`:bodyColor;
  const grad=ctx.createRadialGradient(-s*0.3*bw,-s*0.5*bh,s*0.1,0,0,s*1.2*Math.max(bw,bh));
  grad.addColorStop(0,lightenColor(bodyColor,70));
  grad.addColorStop(0.55,bodyColor);
  grad.addColorStop(1,lightenColor(bodyColor,-70));
  ctx.beginPath();
  ctx.moveTo(0,-s*bh);
  ctx.bezierCurveTo(s*0.95*bw,-s*0.85*bh, s*1.05*bw,s*0.25*bh, s*0.55*bw,s*0.85*bh);
  ctx.bezierCurveTo(s*0.2*bw,s*1.1*bh, -s*0.2*bw,s*1.1*bh, -s*0.55*bw,s*0.85*bh);
  ctx.bezierCurveTo(-s*1.05*bw,s*0.25*bh, -s*0.95*bw,-s*0.85*bh, 0,-s*bh);
  ctx.closePath();
  ctx.fillStyle=grad;
  ctx.shadowBlur=(discoBallOn?26:15)*flashyMul();
  ctx.shadowColor=glowColor;
  ctx.fill();
  ctx.shadowBlur=0;

  ctx.beginPath(); ctx.ellipse(0,s*0.4*bh,s*0.5*bw,s*0.4*bh,0,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-s*0.3*bw,-s*0.55*bh,s*0.35*bw,s*0.22*bh,-0.4,0,Math.PI*2);
  ctx.fillStyle="rgba(255,255,255,0.2)"; ctx.fill();

  if(base.armored){
    ctx.strokeStyle="rgba(0,0,0,0.4)"; ctx.lineWidth=Math.max(1.5,s*0.08);
    for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(i*s*0.4*bw,-s*0.6*bh); ctx.lineTo(i*s*0.4*bw,s*0.7*bh); ctx.stroke(); }
  }

  if(shapeDef.spikes>0){
    ctx.fillStyle=bodyColor;
    const n=shapeDef.spikes;
    for(let i=0;i<n;i++){
      const frac=(i/(n-1||1))-0.5;
      const ix=frac*s*1.5*bw;
      ctx.beginPath();
      ctx.moveTo(ix,-s*0.75*bh);
      ctx.lineTo(ix-s*0.12,-s*(1.15+0.2*(n>3?1:0))*bh);
      ctx.lineTo(ix+s*0.12,-s*(1.15+0.2*(n>3?1:0))*bh);
      ctx.closePath();
      ctx.fill();
    }
  }

  if(e.type!=="shielded"){
    ctx.strokeStyle=bodyColor; ctx.lineWidth=Math.max(1,s*0.09);
    ctx.beginPath(); ctx.moveTo(-s*0.28*bw,-s*0.82*bh); ctx.quadraticCurveTo(-s*0.5*bw,-s*1.5*bh,-s*0.16*bw,-s*1.62*bh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*0.28*bw,-s*0.82*bh); ctx.quadraticCurveTo(s*0.5*bw,-s*1.5*bh,s*0.16*bw,-s*1.62*bh); ctx.stroke();
    ctx.fillStyle=bodyColor;
    ctx.beginPath(); ctx.arc(-s*0.16*bw,-s*1.62*bh,s*0.11,0,Math.PI*2); ctx.arc(s*0.16*bw,-s*1.62*bh,s*0.11,0,Math.PI*2); ctx.fill();
  }

  const eyeY=-s*0.12*bh, eyeW=s*0.28, eyeH=s*0.38;
  if(shapeDef.eyes===1){
    ctx.fillStyle="#001318";
    ctx.beginPath(); ctx.arc(0,eyeY,eyeW*0.9,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=bodyColor; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.arc(-eyeW*0.25,eyeY-eyeH*0.2,eyeW*0.25,0,Math.PI*2); ctx.fill();
  }else if(shapeDef.eyes>0){
    const xs=shapeDef.eyes===3?[-s*0.32*bw,0,s*0.32*bw]:[-s*0.3*bw,s*0.3*bw];
    ctx.fillStyle="#000";
    ctx.beginPath();
    for(const ex of xs) ctx.ellipse(ex,eyeY,eyeW*(shapeDef.eyes===3?0.7:1),eyeH*(shapeDef.eyes===3?0.7:1),ex<0?-0.3:(ex>0?0.3:0),0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.85)";
    ctx.beginPath();
    for(const ex of xs) ctx.arc(ex-eyeW*0.2,eyeY-eyeH*0.25,eyeW*0.22,0,Math.PI*2);
    ctx.fill();
  }

  if(shapeDef.lean){
    ctx.strokeStyle=bodyColor; ctx.globalAlpha=cloakA*0.4; ctx.lineWidth=2;
    for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(-s*1.1-i*s*0.4,-s*0.3+i*s*0.25); ctx.lineTo(-s*0.7-i*s*0.4,-s*0.3+i*s*0.25); ctx.stroke(); }
    ctx.globalAlpha=cloakA;
  }

  drawAreaThemeDecor(ctx,e,themeOverride,s,bw,bh,t);

  if(e.type==="impostor"){
    ctx.fillStyle="#c51111";
    ctx.beginPath(); ctx.ellipse(0,-2,s*0.7,s*0.9,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#9fd8ff";
    ctx.fillRect(-s*0.3,-s*0.5,s*0.5,s*0.35);
    ctx.fillStyle="#8a0d0d";
    ctx.fillRect(-s*0.35,s*0.55,s*0.25,s*0.55);
    ctx.fillRect(s*0.1,s*0.55,s*0.25,s*0.55);
  }

  if(base.tiny && flashyMul()>0.2){
    ctx.fillStyle="rgba(255,255,255,.6)";
    ctx.beginPath(); ctx.arc(s*0.4,s*0.4,s*0.12,0,Math.PI*2); ctx.fill();
  }

  ctx.restore();
}

function drawAlienBody(ctx,e){
  if(flashyMode) drawAlienBodyFlashy(ctx,e); else drawAlienBodyRetro(ctx,e);
  const s=e.size;
  ctx.fillStyle="#555"; ctx.fillRect(e.x-s,e.y-s-14,s*2,5);
  ctx.fillStyle="#39ff14"; ctx.fillRect(e.x-s,e.y-s-14,(s*2)*(Math.max(0,e.hp)/e.maxHp),5);
}

// Renders a small preview of an alien/boss into any arbitrary <canvas>.
function renderAlienIcon(canvasEl,type,opts){
  opts=opts||{};
  if(!canvasEl) return;
  const w=canvasEl.width||canvasEl.clientWidth||96;
  const h=canvasEl.height||canvasEl.clientHeight||96;
  if(canvasEl.width!==w) canvasEl.width=w;
  if(canvasEl.height!==h) canvasEl.height=h;
  const octx=canvasEl.getContext("2d");
  octx.clearRect(0,0,w,h);
  const base=ENEMY_TYPES[type]||{};
  const size=opts.size||Math.min(w,h)*0.28;
  if(canvasEl._bobSeed===undefined) canvasEl._bobSeed=Math.random()*1000;
  const fakeE={
    type,size,
    color:opts.color||base.color||"#39ff14",
    x:w/2, y:h/2+size*0.15,
    bobSeed:opts.bobSeed!==undefined?opts.bobSeed:canvasEl._bobSeed,
    slowTimer:0, cloaked:false, hp:1, maxHp:1
  };
  const useFlashy=opts.flashy!==undefined?opts.flashy:flashyMode;
  canvasEl.classList.toggle("pixel-art",!useFlashy);
  if(useFlashy) drawAlienBodyFlashy(octx,fakeE,opts.theme);
  else drawAlienBodyRetro(octx,fakeE);
}

// Keeps every visible alien-icon canvas gently animated (idle bob, leg
// wiggle, marching frames) instead of a single frozen frame.
let bestiaryIconRegistry=[];
let bestiaryAnimTimer=null;
function registerBestiaryIcon(canvasEl,type,opts){
  bestiaryIconRegistry.push({canvasEl,type,opts:opts||{}});
}
function startBestiaryAnimation(){
  stopBestiaryAnimation();
  bestiaryAnimTimer=setInterval(()=>{
    bestiaryIconRegistry=bestiaryIconRegistry.filter(ic=>ic.canvasEl.isConnected);
    for(const ic of bestiaryIconRegistry){
      if(ic.canvasEl.offsetParent===null) continue;
      renderAlienIcon(ic.canvasEl,ic.type,ic.opts);
    }
  },90);
}
function stopBestiaryAnimation(){
  if(bestiaryAnimTimer){ clearInterval(bestiaryAnimTimer); bestiaryAnimTimer=null; }
}
