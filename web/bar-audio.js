/* Shared, gesture-unlocked sound sprite. One fetch, one active voice, no polling. */
(function(root){
  'use strict';
  const CUES={diceRoll:[25.530430839002268,1.54],tie:[24.82548752834467,0.6049433106575963],handStart:[24.649092970521544,0.07639455782312925],handPaper:[23.099773242630384, 0.07965986394557824],handScissors:[23.279433106575965, 0.36741496598639456],handRock:[24.262993197278913, 0.28609977324263036],currency:[22.36562358276644,0.6341496598639456],paper:[21.5821768707483,0.6834467120181406],confirm:[21.2937641723356,0.18841269841269842],failure:[15.032607709750566, 2.2051473922902494],success:[17.337755102040816, 1.9435827664399092],cancel:[19.381337868480724, 0.6138095238095238],back:[20.09514739229025, 0.0981859410430839],select:[20.293333333333333, 0.18793650793650793],start:[20.58126984126984, 0.6124943310657597],fizzy:[9.932607709750567,5],flightPour:[0.3709750566893424,0.88],detail:[0,0.0709750566893424],pour:[0.1709750566893424,2.681904761904762],openPour:[2.9528798185941043,2.9410204081632654],cocktail:[5.993900226757369,3.9387074829931974]};
  const STRAIGHT=new Set(['清酒','梅子酒','威士忌','白兰地','黑朗姆','朗姆','朗姆酒','白朗姆','伏特加','龙舌兰','金酒']);
  let context,loading,buffer,voice,voiceGain,kind,epoch=0;
  function prepare(){
    try{
      const AudioContext=root.AudioContext||root.webkitAudioContext;
      if(!AudioContext)return Promise.resolve(null);
      context ||= new AudioContext();
      // Called synchronously by the actual click, before network/animation awaits.
      if(context.state==='suspended')context.resume().catch(()=>{});
      if(buffer)return Promise.resolve(buffer);
      return loading ||= root.fetch('/assets/bar/audio/bar-sfx-v14.json')
        .then(r=>{if(!r.ok)throw new Error('audio unavailable');return r.json();})
        .then(data=>context.decodeAudioData(Uint8Array.from(root.atob(data.wav),c=>c.charCodeAt(0)).buffer)).then(data=>buffer=data)
        .catch(()=>null).finally(()=>{loading=null;});
    }catch(_){return Promise.resolve(null);}
  }
  function stop(only){
    if(only&&kind!==only)return;
    epoch++;if(voice){voice.onended=null;try{voice.stop();}catch(_){}voice.disconnect();voice=null;}voiceGain?.disconnect();voiceGain=null;kind=null;
  }
  const handGain=name=>name==='handRock'?.6:name==='handScissors'?.5:1;
  async function play(name,hands,delay=0){
    if((!CUES[name]&&name!=='handsReveal')||root.document?.hidden)return;
    stop();kind=name;const ticket=epoch,started=Date.now(),data=await prepare();
    // Never replay a late download after the relevant visual has passed.
    if(!data||ticket!==epoch||Date.now()-started>700||root.document?.hidden||context.state!=='running')return;
    try{
      const source=context.createBufferSource();let playback=data;
      if(name==='handsReveal'){
        const names=hands.map(h=>['handRock','handPaper','handScissors'][h]);
        const rate=data.sampleRate,mix=context.createBuffer(1,Math.ceil(Math.max(...names.map(n=>CUES[n][1]))*rate),rate),out=mix.getChannelData(0),input=data.getChannelData(0);
        for(const n of names){const offset=Math.round(CUES[n][0]*rate),length=Math.round(CUES[n][1]*rate),gain=handGain(n);for(let i=0;i<length;i++)out[i]+=input[offset+i]*gain;}
        let peak=0;for(const sample of out)peak=Math.max(peak,Math.abs(sample));
        if(peak>.98)for(let i=0;i<out.length;i++)out[i]*=.98/peak;
        playback=mix;
      }
      source.buffer=playback;
      // Blind reveal: a short excerpt of the same pour, natural pitch, soft ending.
      let envelope=null;
      if(name==='flightPour'){
        envelope=context.createGain();const now=context.currentTime;
        envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(1,now+.015);
        envelope.gain.setValueAtTime(1,now+.78);envelope.gain.linearRampToValueAtTime(0,now+.88);
        source.connect(envelope);envelope.connect(context.destination);
      }else if(['success','failure','handRock','handScissors'].includes(name)){
        envelope=context.createGain();envelope.gain.value=name.startsWith('hand')?handGain(name):.7;
        source.connect(envelope);envelope.connect(context.destination);
      }else source.connect(context.destination);
      voice=source;voiceGain=envelope;
      source.onended=()=>{source.disconnect();envelope?.disconnect();if(voice===source){voice=null;voiceGain=null;kind=null;}};
      if(name==='handsReveal')source.start(0);else source.start(context.currentTime+Math.max(0,delay-(Date.now()-started)/1000),...CUES[name]);
    }catch(_){stop();}
  }
  function buttonCue(button,text=''){
    if(button.disabled)return;
    const label=(button.textContent||text).replace(/\s/g,'').toLowerCase();
    if(button.dataset.sound==='drink')return;
    if(['让ta看酒单','看酒单›','✦点酒'].includes(label)){play('paper');return;}
    if(['让ta自选游戏','游戏'].includes(label)){play('currency');return;}
    if(button.matches('.bar-edit-link,.ww-dot,.ww-swatch')){play('select');return;}
    if(['再来一轮','确认','确定','保存','选这杯','用这个作为赌注','查看结果','带着结果找ta','带着结果去找ta'].includes(label))play('confirm');
    else if(['取消','cancel'].includes(label))play('cancel');
    else if(button.classList.contains('bar-back')||button.classList.contains('bf-close')||['收起','关闭','close','知道了','回到赌桌'].includes(label))play('back');
  }
  function isStraight(item){return !!item?.flight||(!item?.special&&STRAIGHT.has(item?.name));}
  function confirmCue(item){
    if(isStraight(item))return 'openPour';
    if(item?.special)return 'cocktail';
    if(['啤酒','可乐','气泡水'].includes(item?.name))return 'fizzy';
    if(['红茶','热水','普洱','绿茶','白水'].includes(item?.name))return 'pour';
    const name=String(item?.name||'').replace(/[「」『』]/g,'');
    if(Number(item?.std)>0&&(/特调|鸡尾酒/.test(item?.group||'')||['金汤力','长岛冰茶','莫斯科骡子'].includes(name)))return 'cocktail';
    return null;
  }
  root.document?.addEventListener('visibilitychange',()=>{if(root.document.hidden)stop();});
  root.addEventListener?.('pagehide',()=>stop());
  // One looping music player, independent of the short effect voice.
  let musicEntered=false,musicEnabled=true,musicGesture=false,musicPlayer,musicContext,musicGain,musicLoading,musicURL;
  try{musicEnabled=root.localStorage.getItem('bar-music-enabled')!=='off';}catch(_){}
  const musicActive=()=>{if(root.document.querySelector('[data-bar-music-home],.bar-screen:not([hidden])'))musicEntered=true;return musicEntered;};
  function musicLabels(){root.document.querySelectorAll('.bar-music-toggle').forEach(b=>{b.querySelector('img').src='/assets/bar/ui/music-'+(musicEnabled?'on':'off')+'.svg';b.setAttribute('aria-pressed',String(musicEnabled));b.setAttribute('aria-label',musicEnabled?'关闭背景音乐':'开启背景音乐');});}
  let portraitNotice;
  function portraitSync(){
    const landscape=root.matchMedia('(any-pointer: coarse)').matches&&(Math.abs(Number(root.orientation))===90||root.screen.width>root.screen.height||root.screen.orientation?.type?.startsWith('landscape'));
    const visible=landscape&&!!root.document.querySelector('[data-bar-music-home],.bar-screen:not([hidden]),.bf-panel');
    if(visible&&!portraitNotice){portraitNotice=root.document.createElement('div');portraitNotice.className='bar-portrait-notice';portraitNotice.setAttribute('role','alert');portraitNotice.innerHTML='<div class="ph" aria-hidden="true"></div><b>请把手机竖过来</b><i>Tournez votre téléphone, s’il vous plaît</i>';root.document.body.append(portraitNotice);}
    if(portraitNotice)portraitNotice.hidden=!visible;
    return visible;
  }
  queueMicrotask(portraitSync);root.addEventListener('resize',portraitSync);root.addEventListener('orientationchange',portraitSync);
  root.document.addEventListener('keydown',e=>{if(portraitNotice&&!portraitNotice.hidden){e.preventDefault();e.stopImmediatePropagation();}},true);
  async function musicSync(){
    portraitSync();musicLabels();
    if(!musicEnabled||!musicGesture||root.document.hidden||!musicActive()){musicPlayer?.pause();return;}
    try{
      const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return;
      if(!musicPlayer){musicPlayer=new root.Audio();musicPlayer.loop=true;musicPlayer.preload='none';musicContext=new AC();musicGain=musicContext.createGain();musicGain.gain.value=.12;musicContext.createMediaElementSource(musicPlayer).connect(musicGain);musicGain.connect(musicContext.destination);}
      await musicContext.resume();
      if(!musicURL){await (musicLoading ||= root.fetch('/assets/bar/audio/last-round-v1.json').then(r=>{if(!r.ok)throw Error('music unavailable');return r.json();}).then(d=>root.fetch('data:audio/mpeg;base64,'+d.base64).then(r=>r.blob())).then(blob=>{musicURL=URL.createObjectURL(blob);musicPlayer.src=musicURL;}).finally(()=>{musicLoading=null;}));}
      if(musicEnabled&&!root.document.hidden&&musicActive())await musicPlayer.play();
    }catch(_){/* A later gesture can retry a blocked or failed load. */}
  }
  function musicButton(){const b=root.document.createElement('button');b.type='button';b.className='bar-music-toggle';b.innerHTML='<img src="/assets/bar/ui/music-'+(musicEnabled?'on':'off')+'.svg" alt="" width="61" height="26">';b.onclick=()=>{musicGesture=true;musicEnabled=!musicEnabled;try{root.localStorage.setItem('bar-music-enabled',musicEnabled?'on':'off');}catch(_){}musicSync();};b.setAttribute('aria-label',musicEnabled?'关闭背景音乐':'开启背景音乐');b.setAttribute('aria-pressed',String(musicEnabled));return b;}
  function musicWake(e){if(e.target.closest?.('.bar-music-toggle'))return;musicGesture=true;musicSync();}
  root.document.addEventListener('pointerdown',musicWake,{passive:true});
  root.document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')musicWake(e);});
  root.document.addEventListener('visibilitychange',musicSync);
  root.addEventListener('pagehide',()=>musicPlayer?.pause());
  root.MamoBarMusic={button:musicButton,sync:()=>queueMicrotask(musicSync)};
  root.MamoBarAudio={prepare,play,playDice:()=>play('diceRoll',null,root.matchMedia('(prefers-reduced-motion: reduce)').matches?0:.6),playHands:(me,ta)=>{if([me,ta].every(h=>[0,1,2].includes(h)))return play('handsReveal',[me,ta]);},stop,isStraight,confirmCue,buttonCue};
})(typeof window!=='undefined'?window:globalThis);
