/* Bar strip: state comes from /state; pending drink comes from the composer. */
(function(root){
  'use strict';
  function describe(state, pending, flight){
    if(!state)return {kind:'loading',tier:'—',value:'—',fraction:0,text:pending?pending.name+' 已备好':'正在取酒单…'};
    const value=Math.max(0,Number(state.alcohol)||0),max=Number(state.alcohol_max)||10;
    let kind='idle',text='今晚喝点什么？';
    if(pending){kind='ready';text=pending.name+' 已备好';}
    else if(state.cup){kind='drinking';text=state.cup.name+' '+state.cup.left+'/'+state.cup.sips;}
    else if(state.cup_end?.reason==='finished'){kind='finished';text='空杯·再来一杯？';}
    else if(state.cup_end?.reason==='expired'){kind='expired';text='这杯收走了，换一杯？';}
    if(value>=Number(state.blackout_at||9)){kind='blackout';text='帮 Ta 换成白水吧？';}
    // A flight on the counter owns the third cell until its six cups are done.
    let tape='afterhours';if(flight){kind=flight.kind;text=flight.text;tape=flight.tape;}
    return {kind,tier:state.tier||'正常',value:value===0?'0':value.toFixed(1),fraction:Math.min(1,value/max),text,tape};
  }
  function render(host,state,pending,actions={}){
    const model=describe(state,pending,actions.flight),doc=host.ownerDocument;
    const el=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
    host.classList.add('bar-strip');host.replaceChildren();host.dataset.state=model.kind;
    const paper=el('div','bar-strip-paper'),tape=el('span','bar-strip-tape',model.tape||'afterhours');
    const row=el('div','bar-strip-row'),tier=el('span','bar-strip-tier','✦ '+model.tier);
    const tube=el('span','bar-strip-tube');tube.setAttribute('role','meter');tube.setAttribute('aria-label','当前醉意');tube.setAttribute('aria-valuemin','0');tube.setAttribute('aria-valuemax',String(state?.alcohol_max||10));
    if(state)tube.setAttribute('aria-valuenow',String(state.alcohol||0));
    // Reveal a fixed full-tube Figma gradient; never stretch or recolor it per value.
    const fill=el('i','bar-strip-fill');fill.style.clipPath='inset(0 '+((1-model.fraction)*100)+'% 0 0)';
    tube.append(fill,el('span','bar-strip-number',model.value));
    const divider=el('img','bar-strip-divider');divider.src='/assets/bar/ui/strip-divider.svg';divider.alt='';
    const info=el('button','bar-strip-info'+(model.text.length>=10?' is-long':''),model.text);info.type='button';info.title=model.kind==='drinking'?'剩余口数／总口数；点击打开酒单':model.text;info.onclick=actions.flight&&state?actions.openFlight:actions.open;
    if(actions.flight?.first&&state){info.classList.add('is-flight-first');info.setAttribute('aria-label','点这里，打开盲品选杯');}
    row.append(tier,tube,divider,info);
    const close=el('button','bar-strip-close');close.append(el('span','bar-strip-close-glyph','×'));close.type='button';close.setAttribute('aria-label','收起吧台');close.onclick=()=>{root.MamoBarAudio?.play('back');actions.close?.();};
    host.append(paper,row,close,tape);
    host.classList.toggle('has-ready',!!pending);
    if(pending){
      const hint=el('div','bar-ready-hint'),note=el('span','','写句话或者直接发送递给Ta');note.setAttribute('role','status');
      const change=el('button','bar-ready-change');change.type='button';change.title='到酒单换一杯';change.setAttribute('aria-label','到酒单换一杯');change.onclick=actions.change||actions.open;
      const icon=el('img','');icon.src='/assets/bar/ui/strip-change.svg';icon.alt='';icon.width=11;icon.height=11;change.append(icon);hint.append(note,change);host.append(hint);
    }
  }
  const api={describe,render};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MamoBarStrip=api;
})(typeof window!=='undefined'?window:globalThis);
