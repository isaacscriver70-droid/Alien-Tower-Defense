// =======================================================================
// SHARED AUDIO ENGINE — identical on every page. No external deps.
// =======================================================================
const AudioEngine=(function(){
  let ctx=null,masterGain=null,musicGain=null,sfxGain=null;
  let musicVolume=0.5,sfxVolume=0.6,muted=false;
  let currentMusicKey=null;

  function ensureCtx(){
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return null;
      ctx=new AC();
      masterGain=ctx.createGain();
      masterGain.connect(ctx.destination);
      musicGain=ctx.createGain();
      musicGain.connect(masterGain);
      sfxGain=ctx.createGain();
      sfxGain.connect(masterGain);
      applyVolumes();
    }
    if(ctx.state==="suspended") ctx.resume().catch(()=>{});
    return ctx;
  }

  function applyVolumes(){
    applyMusicVolumeToAll();
    if(!ctx) return;
    const now=ctx.currentTime;
    masterGain.gain.setTargetAtTime(muted?0:1,now,0.01);
    musicGain.gain.setTargetAtTime(musicVolume,now,0.01);
    sfxGain.gain.setTargetAtTime(sfxVolume,now,0.01);
  }

  function setMusicVolume(v){ musicVolume=Math.max(0,Math.min(1,v)); applyVolumes(); }
  function setSfxVolume(v){ sfxVolume=Math.max(0,Math.min(1,v)); applyVolumes(); }
  function setMuted(m){ muted=!!m; applyVolumes(); }

  function tone(freq,startOffset,dur,type,vol,glideTo,dest){
    const c=ensureCtx();
    if(!c) return;
    const t0=c.currentTime+Math.max(0,startOffset);
    const osc=c.createOscillator();
    osc.type=type||"square";
    osc.frequency.setValueAtTime(Math.max(1,freq),t0);
    if(glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1,glideTo),t0+dur);
    const g=c.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,vol==null?0.4:vol),t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    osc.connect(g);
    g.connect(dest||sfxGain);
    osc.start(t0);
    osc.stop(t0+dur+0.03);
  }

  function noiseBurst(startOffset,dur,vol){
    const c=ensureCtx();
    if(!c) return;
    const t0=c.currentTime+Math.max(0,startOffset);
    const bufferSize=Math.max(1,Math.floor(c.sampleRate*dur));
    const buffer=c.createBuffer(1,bufferSize,c.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=(Math.random()*2-1)*(1-i/bufferSize);
    const src=c.createBufferSource();
    src.buffer=buffer;
    const g=c.createGain();
    g.gain.setValueAtTime(Math.max(0.0001,vol==null?0.25:vol),t0);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    src.connect(g);
    g.connect(sfxGain);
    src.start(t0);
  }

  const SFX={
    shoot:()=>tone(700+Math.random()*80,0,0.06,"square",0.14,320),
    explode:()=>{ noiseBurst(0,0.16,0.2); tone(90,0,0.16,"triangle",0.18,35); },
    build:()=>{ tone(440,0,0.05,"square",0.18); tone(660,0.06,0.08,"square",0.2); },
    upgrade:()=>{ tone(523,0,0.05,"square",0.18); tone(659,0.05,0.05,"square",0.18); tone(880,0.1,0.1,"square",0.2); },
    sell:()=>{ tone(500,0,0.05,"square",0.16); tone(280,0.05,0.09,"square",0.14); },
    burn:()=>tone(210+Math.random()*30,0,0.07,"sawtooth",0.08,100),
    poison:()=>tone(300+Math.random()*20,0,0.08,"triangle",0.09,150),
    freeze:()=>tone(1300,0,0.1,"sine",0.11,750),
    emp:()=>{ tone(950,0,0.07,"square",0.13,220); tone(280,0.05,0.12,"square",0.1,90); },
    zap:()=>tone(900,0,0.06,"square",0.14,150),
    vortex:()=>tone(220,0,0.07,"triangle",0.08,400),
    stun:()=>tone(160,0,0.14,"square",0.14,420),
    hijack:()=>{ tone(280,0,0.09,"sawtooth",0.18,950); tone(950,0.09,0.12,"square",0.2,320); },
    blackhole:()=>{ noiseBurst(0,0.35,0.22); tone(55,0,0.4,"sawtooth",0.28,18); tone(35,0.1,0.5,"sine",0.22,10); },
    enemyDeath:()=>tone(240-Math.random()*50,0,0.07,"square",0.08,55),
    escape:()=>tone(150,0,0.2,"square",0.13,45),
    coreHit:()=>{ noiseBurst(0,0.2,0.18); tone(80,0,0.2,"sawtooth",0.18,35); },
    waveStart:()=>{ tone(392,0,0.07,"square",0.18); tone(523,0.08,0.07,"square",0.18); tone(659,0.16,0.13,"square",0.22); },
    bossSpawn:()=>{ tone(70,0,0.28,"sawtooth",0.26,45); tone(70,0.16,0.28,"sawtooth",0.26,45); },
    bossIncoming:()=>{ [55,55,55].forEach((f,i)=>tone(f,i*0.3,0.26,"sawtooth",0.24,20)); tone(880,0.9,0.3,"square",0.18,80); },
    typeReveal:()=>{ tone(500,0,0.05,"sine",0.14,900); tone(750,0.07,0.09,"sine",0.16,900); tone(1100,0.15,0.14,"sine",0.18,900); },
    victory:()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,i*0.13,0.18,"square",0.2)); },
    bossDown:()=>{ noiseBurst(0,0.4,0.24); tone(60,0,0.5,"sawtooth",0.26,20); [220,330,440,660].forEach((f,i)=>tone(f,0.08+i*0.09,0.16,"square",0.16)); },
    defeat:()=>{ [420,360,300,240].forEach((f,i)=>tone(f,i*0.14,0.2,"sawtooth",0.18)); },
    click:()=>tone(720,0,0.04,"square",0.12),
    denied:()=>tone(160,0,0.12,"square",0.14),
    revive:()=>{ [330,440,550,660,880].forEach((f,i)=>tone(f,i*0.09,0.14,"square",0.2)); },
    crateSpin:()=>tone(500+Math.random()*300,0,0.05,"square",0.1,600),
    winCommon:()=>tone(440,0,0.15,"square",0.2,520),
    winRare:()=>{ [440,660,880].forEach((f,i)=>tone(f,i*0.09,0.14,"square",0.2)); },
    winGodly:()=>{ [220,330,440,550,660,880,1100].forEach((f,i)=>tone(f,i*0.07,0.22,"square",0.24)); noiseBurst(0.4,0.3,0.2); }
  };

  function playSfx(name){
    if(!SFX[name]) return;
    try{ SFX[name](); }catch(e){}
  }

  const MUSIC_FILES={
    menu:"music/00_menu_theme.mp3",
    boss:"music/00_boss_theme.mp3",
    area0:"music/01_the_mainframe.mp3",
    area1:"music/02_magma_depths.mp3",
    area2:"music/03_frozen_wastes.mp3",
    area3:"music/04_dune_sea.mp3",
    area4:"music/05_deep_space.mp3",
    area5:"music/06_toxic_swamp.mp3",
    area6:"music/07_neon_city.mp3",
    area7:"music/08_haunted_grounds.mp3",
    area8:"music/09_the_abyss.mp3",
    area9:"music/10_the_hive_core.mp3",
    crate1:"music/crate_common.mp3",
    crate2:"music/crate_uncommon.mp3",
    crate3:"music/crate_legendary.mp3"
  };

  const musicElements={};
  let currentAudioEl=null;

  function getMusicEl(key){
    if(musicElements[key]) return musicElements[key];
    const src=MUSIC_FILES[key];
    if(!src) return null;
    const el=new Audio(src);
    el.loop=true;
    el.preload="auto";
    el.volume=0;
    el.addEventListener("error",()=>{
      if(currentMusicKey===key) startProceduralFallback(key);
    });
    musicElements[key]=el;
    return el;
  }

  function fadeTo(el,target,ms,onDone){
    if(!el) return;
    const start=el.volume;
    const t0=performance.now();
    function step(){
      const p=Math.min(1,(performance.now()-t0)/ms);
      el.volume=start+(target-start)*p;
      if(p<1){ requestAnimationFrame(step); }
      else if(onDone){ onDone(); }
    }
    step();
  }

  function applyMusicVolumeToAll(){
    const target=muted?0:musicVolume;
    for(const key in musicElements){
      if(musicElements[key]===currentAudioEl) continue;
      musicElements[key].volume=target;
    }
    if(currentAudioEl) currentAudioEl.volume=target;
  }

  function stopFilePlayback(){
    if(currentAudioEl){
      const el=currentAudioEl;
      currentAudioEl=null;
      fadeTo(el,0,450,()=>{ el.pause(); });
    }
  }

  const SCALES={
    major:[0,2,4,5,7,9,11],
    minor:[0,2,3,5,7,8,10],
    minorPent:[0,3,5,7,10],
    majorPent:[0,2,4,7,9],
    phrygian:[0,1,3,5,7,8,10],
    harmonicMinor:[0,2,3,5,7,8,11]
  };

  const TRACKS={
    menu:{bpm:96, root:220.0, scale:"major",        wave:"triangle", bassWave:"square",   energy:0.35},
    boss:{bpm:160,root:110.0, scale:"phrygian",      wave:"sawtooth", bassWave:"square",   energy:0.95},
    area0:{bpm:132,root:196.0, scale:"minor",         wave:"square",   bassWave:"square",   energy:0.6 },
    area1:{bpm:118,root:130.8, scale:"phrygian",      wave:"sawtooth", bassWave:"square",   energy:0.65},
    area2:{bpm:100,root:246.9, scale:"majorPent",     wave:"sine",     bassWave:"triangle", energy:0.35},
    area3:{bpm:112,root:174.6, scale:"harmonicMinor", wave:"square",   bassWave:"square",   energy:0.55},
    area4:{bpm:90, root:164.8, scale:"minorPent",     wave:"sine",     bassWave:"sine",     energy:0.3 },
    area5:{bpm:104,root:146.8, scale:"minor",         wave:"triangle", bassWave:"square",   energy:0.5 },
    area6:{bpm:140,root:207.65,scale:"minorPent",     wave:"square",   bassWave:"sawtooth", energy:0.8 },
    area7:{bpm:88, root:174.6, scale:"phrygian",      wave:"triangle", bassWave:"sine",     energy:0.35},
    area8:{bpm:96, root:130.8, scale:"minorPent",     wave:"sine",     bassWave:"triangle", energy:0.4 },
    area9:{bpm:150,root:116.5, scale:"phrygian",      wave:"sawtooth", bassWave:"square",   energy:0.9 },
    crate1:{bpm:120,root:180.0,scale:"majorPent",     wave:"square",   bassWave:"square",   energy:0.5 },
    crate2:{bpm:140,root:200.0,scale:"minor",         wave:"sawtooth", bassWave:"square",   energy:0.7 },
    crate3:{bpm:170,root:150.0,scale:"harmonicMinor", wave:"sawtooth", bassWave:"square",   energy:1.0 }
  };

  const STEPS=16;
  let schedulerTimer=null;
  let nextStepTime=0;
  let stepIndex=0;
  let trackDef=null;

  function scaleFreq(root,scaleName,degree,octaveShift){
    const scale=SCALES[scaleName]||SCALES.minor;
    const len=scale.length;
    const octave=Math.floor(degree/len)+octaveShift;
    const idx=((degree%len)+len)%len;
    const semitone=scale[idx]+octave*12;
    return root*Math.pow(2,semitone/12);
  }

  function musicTone(freq,time,dur,type,vol){
    const c=ctx;
    if(!c) return;
    const osc=c.createOscillator();
    osc.type=type||"square";
    osc.frequency.setValueAtTime(Math.max(1,freq),time);
    const g=c.createGain();
    g.gain.setValueAtTime(0.0001,time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,vol),time+0.015);
    g.gain.exponentialRampToValueAtTime(0.0001,time+dur);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(time);
    osc.stop(time+dur+0.05);
  }

  function musicNoise(time,dur,vol){
    const c=ctx;
    if(!c) return;
    const bufferSize=Math.max(1,Math.floor(c.sampleRate*dur));
    const buffer=c.createBuffer(1,bufferSize,c.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=(Math.random()*2-1)*(1-i/bufferSize);
    const src=c.createBufferSource();
    src.buffer=buffer;
    const g=c.createGain();
    g.gain.setValueAtTime(Math.max(0.0001,vol),time);
    g.gain.exponentialRampToValueAtTime(0.0001,time+dur);
    src.connect(g);
    g.connect(musicGain);
    src.start(time);
  }

  function scheduleStep(time){
    const td=trackDef;
    if(!td) return;
    if(stepIndex%4===0){
      const deg=(stepIndex===0)?0:(stepIndex===8?4:(Math.random()<0.5?0:2));
      const freq=scaleFreq(td.root/2,td.scale,deg,0);
      musicTone(freq,time,0.32,td.bassWave,0.18*td.energy+0.09);
    }
    if(Math.random()<0.22+td.energy*0.45){
      const degree=Math.floor(Math.random()*8);
      const freq=scaleFreq(td.root,td.scale,degree,1);
      musicTone(freq,time,0.15,td.wave,0.12*td.energy+0.045);
    }
    if(td.energy>0.45 && stepIndex%2===1){
      musicNoise(time,0.045,0.04*td.energy);
    }
    if(td.energy>0.7 && stepIndex%8===0){
      musicNoise(time,0.12,0.09*td.energy);
    }
  }

  function schedulerLoop(){
    const c=ctx;
    if(!c || !trackDef) return;
    const stepDur=60/trackDef.bpm/4;
    while(nextStepTime<c.currentTime+0.12){
      scheduleStep(nextStepTime);
      nextStepTime+=stepDur;
      stepIndex=(stepIndex+1)%STEPS;
    }
  }

  function stopProceduralFallback(){
    if(schedulerTimer){ clearInterval(schedulerTimer); schedulerTimer=null; }
    trackDef=null;
  }

  function startProceduralFallback(key){
    stopFilePlayback();
    const c=ensureCtx();
    trackDef=TRACKS[key]||TRACKS.menu;
    stepIndex=0;
    nextStepTime=c?c.currentTime+0.05:0;
    if(schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer=setInterval(schedulerLoop,25);
    schedulerLoop();
  }

  function stopMusic(){
    currentMusicKey=null;
    stopFilePlayback();
    stopProceduralFallback();
  }

  function playMusic(key){
    if(key===currentMusicKey) return;
    currentMusicKey=key;
    ensureCtx();
    stopProceduralFallback();

    const prevEl=currentAudioEl;
    const nextEl=getMusicEl(key);
    currentAudioEl=nextEl;

    if(prevEl && prevEl!==nextEl){
      fadeTo(prevEl,0,450,()=>{ prevEl.pause(); });
    }
    if(nextEl){
      if(nextEl.paused){
        nextEl.currentTime=0;
        const playPromise=nextEl.play();
        if(playPromise && playPromise.catch){
          playPromise.catch(()=>{
            // Autoplay was blocked (no user gesture on THIS page yet - each
            // page load resets that, since these are now separate HTML
            // pages rather than one single-page app). Fall back to
            // procedural music immediately so something plays; the next
            // click/tap will swap back to the real track via
            // resumeMusicIfNeeded() below.
            if(currentMusicKey===key) startProceduralFallback(key);
          });
        }
      }
      fadeTo(nextEl,muted?0:musicVolume,600);
    }else{
      startProceduralFallback(key);
    }
  }

  function resumeMusicIfNeeded(){
    if(ctx && ctx.state==="suspended") ctx.resume().catch(()=>{});
    if(currentAudioEl && currentAudioEl.paused){
      // Retry the real track. If it succeeds, stop any procedural
      // fallback that had taken over for this key.
      currentAudioEl.play().then(()=>{
        if(trackDef) stopProceduralFallback();
      }).catch(()=>{});
    }
  }

  return {
    ensureCtx,setMusicVolume,setSfxVolume,setMuted,
    playSfx,playMusic,stopMusic,resumeMusicIfNeeded,
    getCurrentMusicKey:()=>currentMusicKey
  };
})();

// Not {once:true}: each new page load starts audio "locked" again (these
// are now separate page loads, not one persistent single-page app), and
// the very first click on a page can happen before music has even tried
// to start. Retrying on every interaction is cheap (no-ops once audio is
// already unlocked and playing) and guarantees it recovers.
["pointerdown","keydown"].forEach(evt=>{
  window.addEventListener(evt,()=>{
    AudioEngine.ensureCtx();
    AudioEngine.resumeMusicIfNeeded();
  });
});

function playSound(type){
  AudioEngine.playSfx(type);
}
