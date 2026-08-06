// =======================================================================
// FRIENDS PAGE LOGIC — WebRTC-based mutual friend requests via PeerJS's
// free public cloud broker (no custom server required). Each player has
// a persistent 6-character ID. To add a friend you enter THEIR id; if
// they currently have this page open, they get a live Accept/Decline
// popup. This is peer-to-peer with no inbox for offline players - both
// sides need the Friends page open at the same time, like a phone call.
// =======================================================================

let peer=null;

function myPlayerId(){
  if(!metaData.myFriendId){
    metaData.myFriendId=generateFriendId();
    saveToStorage(metaData);
  }
  return metaData.myFriendId;
}
function generateFriendId(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (no 0/O, 1/I, etc)
  let code="";
  for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}
function peerFullId(shortId){
  return "atd-friend-"+shortId.toUpperCase(); // namespaced so we don't collide with other apps on the public broker
}

function setConnStatus(text,isError){
  const el=document.getElementById("conn-status");
  if(!el) return;
  el.textContent=text;
  el.style.color=isError?"var(--red)":"#8fae8f";
}

function initPeer(){
  const shortId=myPlayerId();
  peer=new Peer(peerFullId(shortId),{debug:0});
  peer.on("open",()=>{
    setConnStatus("Online - ready to receive friend requests.");
  });
  peer.on("error",(err)=>{
    if(err.type==="unavailable-id"){
      // Extremely rare collision on the shared public broker - regenerate once and retry.
      metaData.myFriendId=generateFriendId();
      saveToStorage(metaData);
      document.getElementById("my-id-display").textContent=metaData.myFriendId;
      peer.destroy();
      initPeer();
      return;
    }
    if(err.type==="peer-unavailable") return; // handled by the per-request timeout instead
    setConnStatus("Connection trouble - friend requests may not work right now.",true);
  });
  peer.on("connection",handleIncomingConnection);
}

function handleIncomingConnection(conn){
  let resolved=false;
  conn.on("data",(msg)=>{
    if(msg.type==="friend_request" && !resolved){
      resolved=true;
      const theirId=conn.peer.replace("atd-friend-","");
      showConfirmModal(
        (msg.name||"Someone")+" ("+theirId+") wants to add you as a friend. Accept?",
        ()=>{
          conn.send({type:"friend_accept",name:getPlayerName()});
          upsertFriend(theirId,msg.name||"Unknown");
          renderFriends();
          playSound("click");
          setTimeout(()=>conn.close(),500);
        },
        ()=>{
          conn.send({type:"friend_decline"});
          setTimeout(()=>conn.close(),500);
        }
      );
    }
  });
}

function sendFriendRequest(shortIdRaw){
  const shortId=(shortIdRaw||"").trim().toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(shortId)){
    setConnStatus("That doesn't look like a valid 6-character friend ID.",true);
    return;
  }
  if(shortId===myPlayerId()){
    setConnStatus("That's your own ID.",true);
    return;
  }
  if((metaData.friends||[]).some(f=>f.friendId===shortId)){
    setConnStatus("Already on your friends list.",true);
    return;
  }
  setConnStatus("Sending friend request to "+shortId+"...");
  const conn=peer.connect(peerFullId(shortId),{reliable:true});
  let settled=false;

  const timeout=setTimeout(()=>{
    if(!settled){
      settled=true;
      setConnStatus("They're not online right now. Try again when they have the Friends page open.",true);
      conn.close();
    }
  },10000);

  conn.on("open",()=>{
    conn.send({type:"friend_request",name:getPlayerName()});
  });
  conn.on("data",(msg)=>{
    if(settled) return;
    if(msg.type==="friend_accept"){
      settled=true;
      clearTimeout(timeout);
      upsertFriend(shortId,msg.name||"Unknown");
      renderFriends();
      setConnStatus("Friend request accepted!");
      playSound("click");
      setTimeout(()=>conn.close(),500);
    }else if(msg.type==="friend_decline"){
      settled=true;
      clearTimeout(timeout);
      setConnStatus("They declined the request.",true);
      setTimeout(()=>conn.close(),500);
    }
  });
  conn.on("error",()=>{
    if(!settled){
      settled=true;
      clearTimeout(timeout);
      setConnStatus("Couldn't reach them - they may be offline.",true);
    }
  });
}

function upsertFriend(friendId,name){
  metaData.friends=metaData.friends||[];
  const existing=metaData.friends.find(f=>f.friendId===friendId);
  if(existing){
    existing.name=name;
  }else{
    metaData.friends.push({id:"f"+Date.now()+Math.floor(Math.random()*1000),friendId,name,code:null});
  }
  saveToStorage(metaData);
}

function renderFriends(){
  const el=document.getElementById("friends-content");
  const friends=metaData.friends||[];
  if(friends.length===0){
    el.innerHTML=`<div style="color:#666;">No friends added yet. Ask a friend for their ID above, then add them below.</div>`;
    return;
  }
  el.innerHTML=friends.map(f=>`
    <div class="ach-card" style="text-align:left;">
      <div class="ach-title">${escapeHtml(f.name)} <span style="color:#666;font-size:.7rem;">(${escapeHtml(f.friendId)})</span></div>
      <div class="ach-desc">${f.code?("Last known co-op code: <b style='color:var(--gold);'>"+escapeHtml(f.code)+"</b>"):"No saved co-op code yet."}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button onclick="editFriendCode('${f.id}')" style="min-height:0;padding:.4em .9em;font-size:.75rem;">EDIT CO-OP CODE</button>
        <button onclick="removeFriend('${f.id}')" style="min-height:0;padding:.4em .9em;font-size:.75rem;color:var(--red);border-color:var(--red);box-shadow:none;">REMOVE</button>
      </div>
    </div>`).join("");
}

function addFriendPrompt(){
  showPromptModal({
    message:"Enter your friend's 6-character ID (they can find it at the top of their own Friends page). They'll get a live Accept/Decline prompt if they're online right now.",
    placeholder:"e.g. K7XQ2M",
    confirmLabel:"SEND REQUEST",
    cancelable:true,
    maxLength:6,
    onSubmit:(val)=>{
      sendFriendRequest(val);
    }
  });
}
window.addFriendPrompt=addFriendPrompt;

function editFriendCode(id){
  const friend=(metaData.friends||[]).find(f=>f.id===id);
  if(!friend) return;
  showPromptModal({
    message:"Save "+friend.name+"'s current co-op code (4 letters).",
    placeholder:"CODE",
    defaultValue:friend.code||"",
    maxLength:4,
    confirmLabel:"SAVE",
    cancelable:true,
    onSubmit:(val)=>{
      friend.code=(val||"").trim().toUpperCase().slice(0,4)||null;
      saveToStorage(metaData);
      renderFriends();
      playSound("click");
    }
  });
}
window.editFriendCode=editFriendCode;

function removeFriend(id){
  const friend=(metaData.friends||[]).find(f=>f.id===id);
  if(!friend) return;
  showConfirmModal("Remove "+friend.name+" from your friends list?",()=>{
    metaData.friends=(metaData.friends||[]).filter(f=>f.id!==id);
    saveToStorage(metaData);
    renderFriends();
    playSound("click");
  },()=>{});
}
window.removeFriend=removeFriend;

function copyMyId(){
  const id=myPlayerId();
  if(navigator.clipboard){
    navigator.clipboard.writeText(id).then(()=>setConnStatus("Copied "+id+" to clipboard!"));
  }else{
    setConnStatus("Your ID: "+id);
  }
}
window.copyMyId=copyMyId;

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme||"menu"));
  document.getElementById("my-id-display").textContent=myPlayerId();
  renderFriends();
  initPeer();
});
