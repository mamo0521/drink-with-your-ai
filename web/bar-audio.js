/* Shared, gesture-unlocked sound sprite. One fetch, one active voice, no polling. */
(function(root){
  'use strict';
  const CUES={confirm:[21.2937641723356,0.18841269841269842],failure:[15.032607709750566, 2.2051473922902494],success:[17.337755102040816, 1.9435827664399092],cancel:[19.381337868480724, 0.6138095238095238],back:[20.09514739229025, 0.0981859410430839],select:[20.293333333333333, 0.18793650793650793],start:[20.58126984126984, 0.6124943310657597],fizzy:[9.932607709750567,5],flightPour:[0.3709750566893424,0.88],detail:[0,0.0709750566893424],pour:[0.1709750566893424,2.681904761904762],openPour:[2.9528798185941043,2.9410204081632654],cocktail:[5.993900226757369,3.9387074829931974]};
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
      return loading ||= root.fetch('/assets/bar/audio/bar-sfx-v6.json')
        .then(r=>{if(!r.ok)throw new Error('audio unavailable');return r.json();})
        .then(data=>context.decodeAudioData(Uint8Array.from(root.atob(data.wav),c=>c.charCodeAt(0)).buffer)).then(data=>buffer=data)
        .catch(()=>null).finally(()=>{loading=null;});
    }catch(_){return Promise.resolve(null);}
  }
  function stop(only){
    if(only&&kind!==only)return;
    epoch++;if(voice){voice.onended=null;try{voice.stop();}catch(_){}voice.disconnect();voice=null;}voiceGain?.disconnect();voiceGain=null;kind=null;
  }
  async function play(name){
    if(!CUES[name]||root.document?.hidden)return;
    stop();kind=name;const ticket=epoch,started=Date.now(),data=await prepare();
    // Never replay a late download after the relevant visual has passed.
    if(!data||ticket!==epoch||Date.now()-started>700||root.document?.hidden||context.state!=='running')return;
    try{
      const source=context.createBufferSource();source.buffer=data;
      // Blind reveal: a short excerpt of the same pour, natural pitch, soft ending.
      let envelope=null;
      if(name==='flightPour'){
        envelope=context.createGain();const now=context.currentTime;
        envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(1,now+.015);
        envelope.gain.setValueAtTime(1,now+.78);envelope.gain.linearRampToValueAtTime(0,now+.88);
        source.connect(envelope);envelope.connect(context.destination);
      }else if(name==='success'||name==='failure'){
        envelope=context.createGain();envelope.gain.value=.7;
        source.connect(envelope);envelope.connect(context.destination);
      }else source.connect(context.destination);
      voice=source;voiceGain=envelope;
      source.onended=()=>{source.disconnect();envelope?.disconnect();if(voice===source){voice=null;voiceGain=null;kind=null;}};
      source.start(0,...CUES[name]);
    }catch(_){stop();}
  }
  function buttonCue(button,text=''){
    if(button.disabled)return;
    const label=(button.textContent||text).replace(/\s/g,'').toLowerCase();
    if(button.dataset.sound==='drink')return;
    if(['确认','确定','保存','选这杯','用这个作为赌注','查看结果','带着结果找ta','带着结果去找ta'].includes(label))play('confirm');
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
  root.MamoBarAudio={prepare,play,stop,isStraight,confirmCue,buttonCue};
})(typeof window!=='undefined'?window:globalThis);
