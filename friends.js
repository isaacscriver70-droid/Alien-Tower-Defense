// =======================================================================
// FRIENDS PAGE LOGIC — a local address book (no server/accounts). Lets
// the player keep a roster of names + optionally the last co-op code
// that friend shared, so the Online Co-op join screen can offer
// one-tap fills instead of retyping a 4-letter code every time.
// =======================================================================
function renderFriends(){
  const el=document.getElementById("friends-content");
  const friends=metaData.friends||[];
  if(friends.length===0){
    el.innerHTML=`<div style="color:#666;">No friends added yet. Add one below, then use "Invite a Friend" from the Online Co-op screen to send them a link.</div>`;
    return;
  }
  el.innerHTML=friends.map(f=>`
    <div class="ach-card" style="text-align:left;">
      <div class="ach-title">${escapeHtml(f.name)}</div>
      <div class="ach-desc">${f.code?("Last known code: <b style='color:var(--gold);'>"+escapeHtml(f.code)+"</b>"):"No saved code yet - it'll save here after you join or invite them."}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button onclick="editFriendCode('${f.id}')" style="min-height:0;padding:.4em .9em;font-size:.75rem;">EDIT CODE</button>
        <button onclick="removeFriend('${f.id}')" style="min-height:0;padding:.4em .9em;font-size:.75rem;color:var(--red);border-color:var(--red);box-shadow:none;">REMOVE</button>
      </div>
    </div>`).join("");
}

function addFriendPrompt(){
  showPromptModal({
    message:"Add a friend to your roster (this is just a local address book on this device - it doesn't notify anyone or create an account for them).",
    placeholder:"Friend's name",
    confirmLabel:"ADD",
    cancelable:true,
    onSubmit:(val)=>{
      const name=sanitizePlayerName(val);
      if(!name) return;
      metaData.friends=metaData.friends||[];
      metaData.friends.push({id:"f"+Date.now()+Math.floor(Math.random()*1000),name,code:null});
      saveToStorage(metaData);
      renderFriends();
      playSound("click");
    }
  });
}
window.addFriendPrompt=addFriendPrompt;

function editFriendCode(id){
  const friend=(metaData.friends||[]).find(f=>f.id===id);
  if(!friend) return;
  showPromptModal({
    message:"Save "+friend.name+"'s current co-op code (4 letters). You'll get this from them when they host, or it fills in automatically when you join or invite them.",
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

initMetaData(function(){
  applyLobbyBackground(metaData.settings.lobbyTheme||"menu");
  AudioEngine.playMusic(lobbyMusicKeyFor(metaData.settings.lobbyTheme||"menu"));
  renderFriends();
});
