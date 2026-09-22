/* Shared, gesture-unlocked sound sprite. One fetch, one active voice, no polling. */
(function(root){
  'use strict';
  const CUES={detail:[0,0.0709750566893424],pour:[0.1709750566893424,2.681904761904762],openPour:[2.9528798185941043,2.9410204081632654]};
  const STRAIGHT=new Set(['清酒','梅子酒','威士忌','白兰地','黑朗姆','朗姆','朗姆酒','白朗姆','伏特加','龙舌兰','金酒']);
  let context,loading,buffer,voice,kind,epoch=0;
  function prepare(){
    try{
      const AudioContext=root.AudioContext||root.webkitAudioContext;
      if(!AudioContext)return Promise.resolve(null);
      context ||= new AudioContext();
      // Called synchronously by the actual click, before network/animation awaits.
      if(context.state==='suspended')context.resume().catch(()=>{});
      if(buffer)return Promise.resolve(buffer);
      return loading ||= root.fetch('/assets/bar/audio/bar-sfx-v1.json')
        .then(r=>{if(!r.ok)throw new Error('audio unavailable');return r.json();})
        .then(data=>context.decodeAudioData(Uint8Array.from(root.atob(data.wav),c=>c.charCodeAt(0)).buffer)).then(data=>buffer=data)
        .catch(()=>null).finally(()=>{loading=null;});
    }catch(_){return Promise.resolve(null);}
  }
  function stop(only){
    if(only&&kind!==only)return;
    epoch++;if(voice){voice.onended=null;try{voice.stop();}catch(_){}voice.disconnect();voice=null;}kind=null;
  }
  async function play(name){
    if(!CUES[name]||root.document?.hidden)return;
    stop();kind=name;const ticket=epoch,started=Date.now(),data=await prepare();
    // Never replay a late download after the relevant visual has passed.
    if(!data||ticket!==epoch||Date.now()-started>700||root.document?.hidden||context.state!=='running')return;
    try{
      const source=context.createBufferSource();source.buffer=data;source.connect(context.destination);voice=source;
      source.onended=()=>{source.disconnect();if(voice===source){voice=null;kind=null;}};
      source.start(0,...CUES[name]);
    }catch(_){stop();}
  }
  function isStraight(item){return !!item?.flight||(!item?.special&&STRAIGHT.has(item?.name));}
  root.document?.addEventListener('visibilitychange',()=>{if(root.document.hidden)stop();});
  root.addEventListener?.('pagehide',()=>stop());
  root.MamoBarAudio={prepare,play,stop,isStraight};
})(typeof window!=='undefined'?window:globalThis);
