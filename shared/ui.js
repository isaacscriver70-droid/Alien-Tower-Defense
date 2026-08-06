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
