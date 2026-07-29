// Minimal service worker: caches the app shell on install so the game
// still opens (and can be installed) without a network connection.
//
// Bumped to v3 + switched from cache.addAll (which is atomic - one
// missing file like a not-yet-added icon fails the ENTIRE install and
// silently leaves nothing cached) to per-file caching, so a missing
// icon just gets skipped instead of breaking offline support.
const CACHE_NAME="alien-td-v3";
const APP_SHELL=[
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install",e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=>
      Promise.all(APP_SHELL.map(url=>
        cache.add(url).catch(err=>{
          console.warn("[AlienTD SW] Skipping uncacheable shell file:",url,err);
        })
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell, falling back to network (and caching
// what we fetch) for anything else, e.g. the Google Font or music files.
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached) return cached;
      return fetch(e.request).then(response=>{
        if(response && response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(e.request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>cached);
    })
  );
});
let netRole=null;               // null | "host" | "client"
let netPeer=null, netRoomCode=null;
let netConns={};                // host: peerId -> {conn, name, ready}
let netConn=null;               // client: single connection to host
let netMyName="Player";
let netPlayerNames={};          // host: peerId -> name (also used for chat labels)
const NET_MAX_TEAM=4;           // host + up to 3 clients
const NET_ICE_SERVERS=[
  {urls:"stun:stun.l.google.com:19302"},
  {urls:"stun:stun.relay.metered.ca:80"},
  {urls:"turn:global.relay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turn:global.relay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turn:global.relay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"}
];
let netTowerIdSeq=1;
function nextTowerId(){ return netTowerIdSeq++; }
function findTowerById(id){ return towers.find(t=>t.id===id); }
let netBroadcastFrameCounter=0;
let netHeartbeatInterval=null, netLastMsgAt=0;
let netCountdownTimer=null;
let netCoopMode="normal";

function netOpenModal(){
  document.getElementById("coop-overlay").style.display="flex";
  if(!netRole){
    document.getElementById("coop-choice-view").style.display="flex";
    document.getElementById("coop-host-view").style.display="none";
    document.getElementById("coop-join-view").style.display="none";
    document.getElementById("coop-waiting-view").style.display="none";
    document.getElementById("coop-status").innerText="";
  }
}
function netCloseModal(){ document.getElementById("coop-overlay").style.display="none"; }
window.netOpenModal=netOpenModal; window.netCloseModal=netCloseModal;

function netStartHost(){
  if(typeof Peer==="undefined"){
    document.getElementById("coop-status").innerText="Networking library failed to load. Check your connection and reload the page.";
    return;
  }
  netTeardown();
  netRole="host";
  netConns={}; netPlayerNames={};
  document.getElementById("coop-choice-view").style.display="none";
  document.getElementById("coop-host-view").style.display="flex";
  document.getElementById("coop-host-code").innerText="....";
  document.getElementById("coop-status").innerText="Setting up...";
  const code=Math.random().toString(36).slice(2,6).toUpperCase();
  netRoomCode=code;
  netPeer=new Peer("atd-"+code,{config:{iceServers:NET_ICE_SERVERS}});
  netPeer.on("open",()=>{
    document.getElementById("coop-host-code").innerText=code;
    document.getElementById("coop-status").innerText="Waiting for teammates to join...";
    netRenderRoster();
  });
  netPeer.on("connection",c=>{
    if(Object.keys(netConns).length>=NET_MAX_TEAM-1){ c.close(); return; }
    netSetupHostConn(c);
  });
  netPeer.on("error",err=>{
    document.getElementById("coop-status").innerText="Connection error ("+(err&&err.type||"unknown")+"). Try again.";
  });
}
window.netStartHost=netStartHost;

function netHostSetMode(m){ if(MODES[m]) netCoopMode=m; }
window.netHostSetMode=netHostSetMode;

function netStartJoinView(){
  document.getElementById("coop-choice-view").style.display="none";
  document.getElementById("coop-join-view").style.display="flex";
  document.getElementById("coop-join-input").value="";
  document.getElementById("coop-status").innerText="";
}
window.netStartJoinView=netStartJoinView;

function netJoinSubmit(){
  const raw=document.getElementById("coop-join-input").value.trim().toUpperCase();
  if(!raw) return;
  if(typeof Peer==="undefined"){
    document.getElementById("coop-status").innerText="Networking library failed to load. Check your connection and reload the page.";
    return;
  }
  netTeardown();
  netRole="client";
  document.getElementById("coop-status").innerText="Connecting...";
  netPeer=new Peer({config:{iceServers:NET_ICE_SERVERS}});
  netPeer.on("open",()=>{
    const c=netPeer.connect("atd-"+raw,{reliable:true});
    netSetupClientConn(c);
  });
  netPeer.on("error",()=>{
    document.getElementById("coop-status").innerText="Couldn't connect. Check the code and try again.";
    netRole=null;
  });
}
window.netJoinSubmit=netJoinSubmit;

function netSetupHostConn(c){
  const entry={conn:c,name:"Player "+(Object.keys(netConns).length+2),ready:true};
  netConns[c.peer]=entry;
  c.on("open",()=>{
    netLastMsgAt=Date.now();
    netStartHeartbeat();
    entry.conn.send({t:"welcome",name:entry.name,mode:netCoopMode});
    netRenderRoster();
    netBroadcast({t:"roster",names:Object.values(netConns).map(e=>e.name)},c.peer);
  });
  c.on("data",msg=>{ netLastMsgAt=Date.now(); netHandleHostMessage(c,msg); });
  c.on("close",()=>netHandlePeerLeft(c.peer));
  c.on("error",()=>netHandlePeerLeft(c.peer));
}

function netSetupClientConn(c){
  netConn=c;
  netConn.on("open",()=>{
    netLastMsgAt=Date.now();
    netStartHeartbeat();
    document.getElementById("coop-host-view").style.display="none";
    document.getElementById("coop-join-view").style.display="none";
    document.getElementById("coop-waiting-view").style.display="flex";
    document.getElementById("coop-status").innerText="Connected!";
  });
  netConn.on("data",msg=>{ netLastMsgAt=Date.now(); netHandleClientMessage(msg); });
  netConn.on("close",()=>netHandlePeerLeft(null));
  netConn.on("error",()=>netHandlePeerLeft(null));
}

function netRenderRoster(){
  const el=document.getElementById("coop-roster");
  if(!el) return;
  const names=["You (Host)",...Object.values(netConns).map(e=>e.name)];
  el.innerHTML=names.map(n=>"&#9679; "+n).join("<br>");
}
function netRenderRosterClient(names){
  const el=document.getElementById("coop-roster-client");
  if(el) el.innerHTML=names.map(n=>"&#9679; "+n).join("<br>");
}

function netShowCountdown(n){
  const overlay=document.getElementById("coop-countdown-overlay");
  const numEl=document.getElementById("coop-countdown-number");
  if(!overlay||!numEl) return;
  overlay.style.display="flex";
  numEl.innerText=n>0?String(n):"GO!";
}
function netHideCountdown(){
  clearTimeout(netCountdownTimer); netCountdownTimer=null;
  const overlay=document.getElementById("coop-countdown-overlay");
  if(overlay) overlay.style.display="none";
}
function netHostBeginCountdown(){
  if(netRole!=="host") return;
  if(Object.keys(netConns).length===0){
    document.getElementById("coop-status").innerText="Waiting for at least one teammate.";
    return;
  }
  netCloseModal();
  currentMode=netCoopMode;
  netBroadcast({t:"countdown",mode:netCoopMode});
  let n=3;
  netShowCountdown(n);
  const tick=()=>{
    n--;
    if(n>=0){ netShowCountdown(n); netCountdownTimer=setTimeout(tick,1000); }
    else{ netHideCountdown(); startGame(); }
  };
  netCountdownTimer=setTimeout(tick,1000);
}
window.netHostBeginCountdown=netHostBeginCountdown;

function netStartHeartbeat(){
  clearInterval(netHeartbeatInterval);
  netHeartbeatInterval=setInterval(()=>{
    if(netRole==="host"){
      Object.values(netConns).forEach(e=>{ if(e.conn.open) try{ e.conn.send({t:"ping"}); }catch(err){} });
    }else if(netConn && netConn.open){
      try{ netConn.send({t:"ping"}); }catch(err){}
      if(netLastMsgAt && Date.now()-netLastMsgAt>12000) netHandlePeerLeft(null);
    }
  },3000);
}
function netStopHeartbeat(){ clearInterval(netHeartbeatInterval); netHeartbeatInterval=null; }

function netCancelSetup(){ netTeardown(); netCloseModal(); netUpdateLobbyUI(); }
window.netCancelSetup=netCancelSetup;

function netTeardown(){
  netStopHeartbeat();
  netHideCountdown();
  if(netRole==="host"){ Object.values(netConns).forEach(e=>{ try{ e.conn.close(); }catch(err){} }); netConns={}; }
  if(netConn){ try{ netConn.close(); }catch(err){} netConn=null; }
  if(netPeer){ try{ netPeer.destroy(); }catch(err){} netPeer=null; }
  netRole=null; netRoomCode=null;
}

function netHandlePeerLeft(peerId){
  if(netRole==="host"){
    if(peerId && netConns[peerId]){
      const leftName=netConns[peerId].name;
      delete netConns[peerId];
      netRenderRoster();
      netBroadcast({t:"roster",names:Object.values(netConns).map(e=>e.name)});
      netBroadcast({t:"chat",from:"System",text:leftName+" disconnected."});
      addCoopChatLine("System",leftName+" disconnected.");
    }
    return;
  }
  // client lost the host
  netStopHeartbeat();
  netHideCountdown();
  const wasPlaying=isPlaying;
  netConn=null;
  if(wasPlaying){
    isPlaying=false;
    cancelAnimationFrame(gameLoopId);
    showAlertThemed("Connection to the host was lost.","var(--red)",()=>{ returnToLobbyFromGameOver(); });
  }
  netTeardown();
  netUpdateLobbyUI();
}

function netUpdateLobbyUI(){
  const waitBanner=document.getElementById("coop-client-waiting-banner");
  const deployBtn=document.querySelector('.menu-actions button[onclick="startGame()"]');
  const modeSel=document.getElementById("mode-select");
  const badge=document.getElementById("coop-badge");
  const isClientConnected=netRole==="client" && netConn && netConn.open;
  if(waitBanner) waitBanner.style.display=isClientConnected?"block":"none";
  if(deployBtn) deployBtn.style.display=isClientConnected?"none":"inline-block";
  if(modeSel) modeSel.style.display=isClientConnected?"none":"inline-block";
  if(badge){
    if(netRole==="host" && Object.keys(netConns).length>0){ badge.style.display="inline-block"; badge.innerText="\uD83D\uDFE2 CO-OP HOST ("+(Object.keys(netConns).length+1)+"/4)"; }
    else if(isClientConnected){ badge.style.display="inline-block"; badge.innerText="\uD83D\uDFE2 CO-OP GUEST"; }
    else{ badge.style.display="none"; }
  }
  const chatToggle=document.getElementById("coop-chat-toggle");
  if(chatToggle) chatToggle.style.display=(netRole && isPlaying)?"block":"none";
}

// ---- message relay (star topology: host relays everything) ----
function netBroadcast(msg,exceptPeerId){
  Object.entries(netConns).forEach(([pid,e])=>{
    if(pid===exceptPeerId) return;
    if(e.conn.open) try{ e.conn.send(msg); }catch(err){}
  });
}
function netSendAction(type,payload){
  if(netRole!=="client" || !netConn || !netConn.open) return;
  try{ netConn.send({t:"action",type,payload}); }catch(e){}
}
function netHandleHostMessage(conn,msg){
  if(!msg || !msg.t) return;
  if(msg.t==="ping"){ if(conn.open) try{ conn.send({t:"pong"}); }catch(e){} return; }
  if(msg.t==="pong") return;
  if(msg.t==="setName"){ if(netConns[conn.peer]){ netConns[conn.peer].name=msg.name||netConns[conn.peer].name; netRenderRoster(); netBroadcast({t:"roster",names:Object.values(netConns).map(e=>e.name)}); } return; }
  if(msg.t==="chat"){
    const name=(netConns[conn.peer]&&netConns[conn.peer].name)||"Teammate";
    addCoopChatLine(name,msg.text);
    netBroadcast({t:"chat",from:name,text:msg.text},conn.peer);
    return;
  }
  if(msg.t==="action") netApplyAction(msg.type,msg.payload);
}
function netHandleClientMessage(msg){
  if(!msg || !msg.t) return;
  if(msg.t==="ping"){ if(netConn && netConn.open) try{ netConn.send({t:"pong"}); }catch(e){} return; }
  if(msg.t==="pong") return;
  if(msg.t==="welcome"){ netCoopMode=msg.mode||"normal"; return; }
  if(msg.t==="roster"){ netRenderRosterClient(["Host",...msg.names.filter((n,i)=>true)]); return; }
  if(msg.t==="chat"){ addCoopChatLine(msg.from,msg.text); return; }
  if(msg.t==="state") netApplyState(msg);
  else if(msg.t==="countdown"){ netCloseModal(); currentMode=msg.mode||"normal"; netShowCountdown(3); }
  else if(msg.t==="start") netEnterGameAsClient();
  else if(msg.t==="gameOver") endGame(msg.status);
}

// ---- chat ----
function toggleCoopChat(){
  const panel=document.getElementById("coop-chat-panel");
  const btn=document.getElementById("coop-chat-toggle");
  const show=panel.style.display==="none";
  panel.style.display=show?"block":"none";
  btn.style.display=show?"none":"block";
}
window.toggleCoopChat=toggleCoopChat;
function addCoopChatLine(from,text){
  const log=document.getElementById("coop-chat-log");
  if(!log) return;
  const line=document.createElement("div");
  line.style.marginBottom="4px";
  line.innerHTML=`<b style="color:var(--cyan)">${from}:</b> ${text.replace(/</g,"&lt;")}`;
  log.appendChild(line);
  log.scrollTop=log.scrollHeight;
}
function sendCoopChat(){
  const input=document.getElementById("coop-chat-input");
  const text=(input.value||"").trim();
  if(!text || !netRole) return;
  input.value="";
  if(netRole==="host"){
    addCoopChatLine("You (Host)",text);
    netBroadcast({t:"chat",from:"Host",text});
  }else if(netConn && netConn.open){
    addCoopChatLine("You",text);
    try{ netConn.send({t:"chat",text}); }catch(e){}
  }
}
window.sendCoopChat=sendCoopChat;

function netApplyAction(type,payload){
  if(!isPlaying) return;
  if(type==="placeTower"){
    const stat=TOWER_STATS[payload.type];
    if(!stat) return;
    if(payload.type==="flosswall" && flossWallPlaced) return;
    const effCost=stat.isWall?getFlossWallCost():stat.cost;
    if(gold>=effCost && isValidPlacement(payload.x,payload.y)){ buildTower(payload.x,payload.y,payload.type); playSound("build"); }
  }else if(type==="upgradeTower"){
    const t=findTowerById(payload.id); if(t) upgradeTower(t);
  }else if(type==="sellTower"){
    const t=findTowerById(payload.id); if(t) sellTower(t);
  }else if(type==="moveTower"){
    const t=findTowerById(payload.id); if(t) moveTowerTo(t,payload.x,payload.y);
  }else if(type==="flossTower"){
    const t=findTowerById(payload.id); if(t) flossTower(t);
  }else if(type==="fuseFloss"){
    const a=findTowerById(payload.aId), b=findTowerById(payload.bId); if(a && b) fuseFlosslings(a,b);
  }else if(type==="collectGold"){
    tryCollectGoldDrop(payload.x,payload.y);
  }else if(type==="togglePause"){
    togglePause();
  }
}

function netMaybeBroadcastState(){
  if(netRole!=="host" || Object.keys(netConns).length===0) return;
  netBroadcastFrameCounter++;
  if(netBroadcastFrameCounter%2!==0) return;
  netSendState();
}
function netSendState(){
  const towersOut=towers.map(t=>{ const {target,...rest}=t; return rest; });
  const msg={
    t:"state", gold, lives, wave, enemiesLeft, isPaused, killsThisGame, mode:currentMode,
    towers:towersOut,
    enemies:enemies.map(e=>({...e})),
    projectiles:projectiles.map(p=>({x:p.x,y:p.y,color:p.color})),
    particles:particles.slice(-60).map(p=>({...p}))
  };
  netBroadcast(msg);
}
function netApplyState(msg){
  if(!isPlaying){
    netHideCountdown();
    isPlaying=true;
    resetScreenScroll();
    document.getElementById("game-over-screen").style.display="none";
    document.getElementById("winner-screen").style.display="none";
    document.getElementById("main-menu").style.display="none";
    document.getElementById("game-container").style.display="flex";
    gameLoopId=requestAnimationFrame(loop);
  }
  gold=msg.gold; lives=msg.lives; wave=msg.wave; enemiesLeft=msg.enemiesLeft;
  killsThisGame=msg.killsThisGame; currentMode=msg.mode||currentMode;
  towers=msg.towers; enemies=msg.enemies; projectiles=msg.projectiles; particles=msg.particles;
  const wasPaused=isPaused;
  isPaused=msg.isPaused;
  if(wasPaused!==isPaused){
    const pb=document.getElementById("btn-pause");
    if(pb){ pb.innerText=isPaused?"RESUME":"PAUSE"; pb.classList.toggle("active",isPaused); }
  }
  updateHUD();
}

function netEnterGameAsClient(){
  netHideCountdown();
  resetScreenScroll();
  netCloseModal();
  document.getElementById("main-menu").style.display="none";
  document.getElementById("game-container").style.display="flex";
  document.getElementById("game-over-screen").style.display="none";
  document.getElementById("winner-screen").style.display="none";
  resize();
  towers=[]; enemies=[]; projectiles=[]; particles=[];
  selectedShopItem=null; selectedTower=null; moveModeTower=null;
  document.getElementById("upgrade-panel").style.display="none";
  document.getElementById("shop-panel").style.display="block";
  document.getElementById("shop-open-btn").style.display="none";
  renderShopCards();
  isPlaying=true; isPaused=false;
  updateHUD();
  netUpdateLobbyUI();
  gameLoopId=requestAnimationFrame(loop);
}
