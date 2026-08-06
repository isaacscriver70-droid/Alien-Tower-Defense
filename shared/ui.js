// =======================================================================
// SHARED UI — modal dialogs + small full-page UX touches. Every page
// must include the #ui-modal-overlay markup (see partials.js) for this
// to have somewhere to render into.
// =======================================================================
function showModal(message,buttons){
  const overlay=document.getElementById("ui-modal-overlay");
  document.getElementById("ui-modal-message").innerText=message;
  const btnRow=document.getElementById("ui-modal-buttons");
  btnRow.innerHTML="";
  buttons.forEach(b=>{
    const btn=document.createElement("button");
    btn.innerText=b.label;
    if(b.danger) btn.classList.add("ui-modal-btn-danger");
    btn.onclick=()=>{
      overlay.style.display="none";
      if(b.onClick) b.onClick();
    };
    btnRow.appendChild(btn);
  });
  overlay.style.display="flex";
}
function showAlertModal(message,onOk){ showModal(message,[{label:"OK",onClick:onOk}]); }
function showConfirmModal(message,onConfirm,onCancel){
  showModal(message,[{label:"CANCEL",onClick:onCancel},{label:"CONFIRM",onClick:onConfirm,danger:true}]);
}

// ---------------------------------------------------------------------
// TEXT-PROMPT MODAL — a small dialog with one text input, built fresh
// each time so no page markup has to be edited to support it. Used for
// the player-name prompt/editor and for adding friends.
// ---------------------------------------------------------------------
function showPromptModal(opts){
  const existing=document.getElementById("ui-prompt-overlay");
  if(existing) existing.remove();
  const overlay=document.createElement("div");
  overlay.id="ui-prompt-overlay";
  overlay.className="ui-modal-overlay";
  overlay.style.display="flex";
  overlay.style.zIndex="9000";

  const box=document.createElement("div");
  box.className="ui-modal-box";
  box.style.borderColor="var(--cyan)";
  box.style.boxShadow="0 0 40px rgba(0,240,255,.5)";

  const msg=document.createElement("div");
  msg.className="ui-modal-message";
  msg.innerText=opts.message||"";
  box.appendChild(msg);

  const input=document.createElement("input");
  input.type="text";
  input.id="ui-prompt-input";
  input.maxLength=opts.maxLength||18;
  input.placeholder=opts.placeholder||"";
  input.value=opts.defaultValue||"";
  input.autocomplete="off";
  input.style.cssText="width:100%;box-sizing:border-box;padding:12px;font-family:'Orbitron';font-size:1.05rem;letter-spacing:1px;text-align:center;background:rgba(0,0,0,.6);border:2px solid var(--cyan);color:var(--cyan);border-radius:8px;margin-bottom:20px;";
  box.appendChild(input);

  const btnRow=document.createElement("div");
  btnRow.className="ui-modal-buttons";

  function submit(){
    const val=input.value;
    overlay.remove();
    if(opts.onSubmit) opts.onSubmit(val);
  }
  input.addEventListener("keydown",e=>{ if(e.key==="Enter") submit(); });

  if(opts.cancelable){
    const cancelBtn=document.createElement("button");
    cancelBtn.innerText="CANCEL";
    cancelBtn.style.cssText="color:#888;border-color:#555;box-shadow:none;";
    cancelBtn.onclick=()=>{ overlay.remove(); if(opts.onCancel) opts.onCancel(); };
    btnRow.appendChild(cancelBtn);
  }
  const okBtn=document.createElement("button");
  okBtn.innerText=opts.confirmLabel||"OK";
  okBtn.onclick=submit;
  btnRow.appendChild(okBtn);

  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(()=>input.focus(),50);
}

function escapeHtml(str){
  return String(str==null?"":str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
window.escapeHtml=escapeHtml;

function sanitizePlayerName(raw){
  let name=(raw||"").replace(/\s+/g," ").trim();
  name=name.slice(0,18);
  return name;
}

// Shown once, the first time any page loads with no name saved yet.
function ensurePlayerName(cb){
  if(metaData && metaData.playerName){ cb(); return; }
  showPromptModal({
    message:"Welcome, Commander! Enter a name for the leaderboard.\n\nHeads up: this is LOCAL to this device only (no server) - the name you pick is stored here and shown next to any scores you set on the Leaderboard page.",
    placeholder:"Your name",
    confirmLabel:"START",
    cancelable:false,
    onSubmit:(val)=>{
      let name=sanitizePlayerName(val);
      if(!name) name="Commander";
      metaData.playerName=name;
      saveToStorage(metaData);
      cb();
    }
  });
}

// Lets the player change their name later from Settings.
function openChangeNameModal(){
  showPromptModal({
    message:"Change your leaderboard name.\n\nThis only affects future scores - past leaderboard entries keep the name you had when you set them.",
    placeholder:"Your name",
    defaultValue:metaData.playerName||"",
    confirmLabel:"SAVE",
    cancelable:true,
    onSubmit:(val)=>{
      let name=sanitizePlayerName(val);
      if(!name) return;
      metaData.playerName=name;
      saveToStorage(metaData);
      const el=document.getElementById("settings-player-name");
      if(el) el.innerText=name;
      if(typeof playSound==="function") playSound("click");
    }
  });
}
window.showPromptModal=showPromptModal;
window.ensurePlayerName=ensurePlayerName;
window.openChangeNameModal=openChangeNameModal;

// ---------------------------------------------------------------------
// Click ring effect - a ring in the color of whatever was clicked
// ---------------------------------------------------------------------
function colorFromElement(el){
  while(el && el!==document.body){
    const cs=getComputedStyle(el);
    if(cs.borderColor && cs.borderColor!=="rgba(0, 0, 0, 0)" && cs.borderColor!=="transparent") return cs.borderColor;
    if(cs.color && cs.color!=="rgba(0, 0, 0, 0)") return cs.color;
    el=el.parentElement;
  }
  return "#39ff14";
}
document.addEventListener("pointerdown",e=>{
  const ring=document.createElement("div");
  ring.className="click-ring";
  ring.style.left=e.clientX+"px";
  ring.style.top=e.clientY+"px";
  ring.style.setProperty("--ring-color",colorFromElement(e.target));
  const mul=(typeof flashyMul==="function")?flashyMul():1;
  ring.style.transform="translate(-50%,-50%) scale("+(0.3+mul*0.7)+")";
  document.body.appendChild(ring);
  setTimeout(()=>ring.remove(),520);
},{passive:true});

// ---------------------------------------------------------------------
// Anti-zoom guards (mobile) - shared by every page
// ---------------------------------------------------------------------
document.addEventListener("gesturestart",e=>e.preventDefault());
document.addEventListener("gesturechange",e=>e.preventDefault());
document.addEventListener("gestureend",e=>e.preventDefault());
document.addEventListener("touchmove",e=>{ if(e.touches && e.touches.length>1) e.preventDefault(); },{passive:false});
let __lastTouchEndTime=0;
document.addEventListener("touchend",e=>{
  const now=Date.now();
  if(now-__lastTouchEndTime<350) e.preventDefault();
  __lastTouchEndTime=now;
},{passive:false});
document.addEventListener("dblclick",e=>e.preventDefault());

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

// Scroll every .screen (and the page itself) back to the top - handy
// whenever a page loads mid-scroll from browser history restore.
function resetScreenScroll(){
  document.querySelectorAll(".screen").forEach(el=>{ el.scrollTop=0; });
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
  window.scrollTo(0,0);
}
