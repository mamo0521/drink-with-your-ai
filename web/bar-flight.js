/* Blind flight picker. The server owns the cups; this view only shows what has
 * been revealed and asks the server to reveal one more. */
(function(root){
  'use strict';
  const WHO={me:'你',ta:'Ta'};
  // Strip copy for an active flight; null when there is none.
  function stripText(flight){
    if(!flight||flight.done)return null;
    // 左上角胶带写项目名，轮到谁写在右边（Figma 1469:4415）。
    const first=flight.turn==='me'&&flight.left.length===6;
    return {kind:flight.turn==='me'?'flight-me':'flight-ta',tape:'盲品 flight',text:(flight.turn==='me'?'your turn':'his turn')+'·'+(first?'点这里':'剩'+flight.left.length+'杯'),first};
  }
  // Deeper colour = stronger cup. Values come from the revealed cup only.
  function tone(cup){const std=Number(cup.std)||0;return std<=0?'water':std>=2?'high':std>=1?'mid':'low';}
  // Figma「盲品杯型」：未揭为空杯；双方揭晓后都按酒的烈度显示杯子。
  function art(cup){
    if(!cup.revealed)return 'flight-cup-empty';
    return 'flight-cup-'+tone(cup);
  }
  function carryText(pick){
    if(!pick.std)return pick.cup+' 号杯 · '+pick.name+' · 没事';
    return pick.cup+'号杯 · 任务 · '+(pick.prank||'点击查看');
  }
  const START='【盲品】',END='【盲品结束】';
  // Same shape the gateway writes (bar_flight.message_block); the server copy replaces this one on send.
  function encode(pick,note=''){
    const f=pick.flight||{},head=pick.cup+' 号杯 · '+pick.name+(pick.std?' · '+Number(pick.std)+' 标准杯':'');
    const me=pick.player||'对方';   // 和网关 bar_games.player_name() 同一个称呼；正文不用他/她
    const body=pick.std?me+' 揭的，这杯不用喝，换成'+pick.tier+'档整蛊题。这道题由 '+me+' 来做、来回答，你负责验收（题面里出现 Ta 或“我”时指的是你）。当场在聊天里兑现：\n「'+pick.prank+'」':me+' 揭的，白水，这一杯没事。';
    const status=f.done?'六杯都揭完了，这场盲品结束。':'还没揭的杯：'+(f.left||[]).join('、')+' 号。现在轮到你选。';
    return [START,head,body,status,END].join('\n')+(note.trim()?'\n\n'+note.trim():'');
  }
  // Card model for MamoBarResult.card: the prank reads like the note that came with the cup.
  function decode(text){
    text=String(text||'');if(!text.startsWith(START+'\n'))return null;
    const end=text.indexOf('\n'+END);if(end<0||end>4000)return null;
    const lines=text.slice(START.length+1,end).split('\n'),title=lines.shift()||'盲品';
    const block=lines.join('\n'),prank=block.match(/「([\s\S]+)」/),tier=block.match(/换成(.+?)档整蛊题/),left=block.match(/还没揭的杯：(.+?) 号/);
    const out=prank?['任务','「'+prank[1]+'」']:['白水，这一杯没事'];
    out.push(/结束/.test(lines.at(-1)||'')?'六杯都揭完了':left?'还剩 '+left[1]+' 号 · 轮到 Ta':'');
    return {label:'盲品',title,lines:out.filter(Boolean),note:text.slice(end+END.length+1).trim()};
  }
  function create(options={}){
    const doc=root.document;
    const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
    const button=(cls,text,fn)=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
    const reduced=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let flight=null,panel=null,busy=false,focusBefore=null,revealed=null,announcedOwed='',opening=false,openVersion=0,refreshing=null;
    async function call(url,body){
      // 连不上（吧台进程正在重启 / 换班）≠ 出错：等一下再试，揭杯这类请求服务器端是幂等的，重发安全。
      let r,tries=0;
      for(;;){try{r=await (options.fetch||root.fetch)(url,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);break;}
        catch(e){if(++tries>2)throw new Error('吧台暂时没有回应。等几秒再点一次');await new Promise(done=>setTimeout(done,1500));}}
      const data=await r.json().catch(()=>({}));
      if(data.flight!==undefined){flight=data.flight;options.onChange?.(flight);const owedKey=flight?.owed?flight.id+':'+flight.owed.cup:'';if(owedKey&&owedKey!==announcedOwed&&!revealed){announcedOwed=owedKey;options.onCarry?.({...flight.owed,who:'me',flight});}}
      if(!r.ok||data.ok===false)throw new Error(data.error||'吧台没有回应，请重试');
      return data;
    }
    function refresh(){return refreshing||(refreshing=call('/barflight').catch(()=>{}).then(()=>flight).finally(()=>{refreshing=null;}));}
    async function start(){const data=await call('/barflight/start',{intimate:!!root.MamoBarBank?.intimate()});return data.flight;}
    // Any way out after a reveal takes the cup along: the ×, the shade, Escape or the button.
    function close(){openVersion++;opening=false;if(!panel)return;panel.remove();panel=null;busy=false;focusBefore?.focus?.({preventScroll:true});const pick=revealed;revealed=null;if(pick)options.onCarry?.(pick);}
    function glass(cup){
      const b=button('bf-cup','',()=>reveal(cup.n,b));b.dataset.n=cup.n;
      const glass=el('span','bf-glass'),img=el('img','bf-cup-art');img.alt='';img.width=44;img.height=45;glass.append(img);
      const smoke=el('span','bf-smoke');smoke.setAttribute('aria-hidden','true');
      for(let i=1;i<=5;i++){const petal=el('i'),fog=el('img');fog.src='/assets/bar/ui/flight-fog-'+i+'.svg';fog.alt='';petal.append(fog);smoke.append(petal);}glass.append(smoke);
      b.append(glass,el('span','bf-number',String(cup.n)));paint(b,cup);return b;
    }
    function paint(b,cup,animate=false){
      const artwork=art(cup),glass=b.querySelector('.bf-glass');
      glass.querySelector('.bf-fill-window')?.remove();b.classList.remove('is-pouring');
      b.querySelector('.bf-cup-art').src='/assets/bar/ui/'+artwork+'.svg';
      if(animate&&!reduced()&&artwork.startsWith('flight-cup-')&&artwork!=='flight-cup-empty'){
        const fill=el('span','bf-fill-window'),image=el('img','bf-fill-art');
        image.alt='';image.width=44;image.height=45;image.src='/assets/bar/ui/'+artwork+'.svg';fill.append(image);glass.append(fill);
        b.querySelector('.bf-cup-art').src='/assets/bar/ui/flight-cup-empty.svg';b.classList.add('is-pouring');
      }
      b.classList.toggle('is-revealed',!!cup.revealed);b.disabled=!!cup.revealed||flight?.turn!=='me';
      b.querySelector('.bf-label')?.remove();
      if(cup.revealed){b.setAttribute('aria-label',cup.n+' 号杯：'+cup.name+'，'+WHO[cup.who]+'揭的');const label=el('span','bf-label');label.append(el('strong','',cup.name),el('em','',WHO[cup.who]));b.append(label);}
      else b.setAttribute('aria-label',cup.n+' 号杯，还没揭');
    }
    function body(){
      const box=panel.querySelector('.bf-box');box.replaceChildren();
      const head=el('header','bf-head');head.append(el('p','bf-kicker','— blind flight —'),el('h2','',flight.turn==='me'?'挑一杯':'等 Ta 挑一杯'));
      const x=button('bf-close','×',close);x.setAttribute('aria-label','收起盲品');head.append(x);
      const row=el('div','bf-row');for(const cup of flight.cups)row.append(glass(cup));
      const note=el('p','bf-note',flight.turn==='me'?'白水、酒都有可能。你揭到酒，换一张任务纸条。':'这一杯轮到 Ta。回聊天里等 Ta 挑，或者催一催。');note.setAttribute('aria-live','polite');
      const menu=button('bf-menu','看酒单 ›',()=>{close();options.onMenu?.();});
      box.append(head,row,note,menu);
    }
    async function reveal(n,b){
      if(busy||!flight||flight.turn!=='me')return;busy=true;
      const activePanel=panel,note=panel.querySelector('.bf-note'),box=panel.querySelector('.bf-box');box.style.height=box.offsetHeight+'px';panel.querySelectorAll('.bf-cup').forEach(c=>c.disabled=true);note.textContent='正在揭杯…';
      const pause=ms=>new Promise(r=>setTimeout(r,reduced()?0:ms));
      try{
        const data=await call('/barflight/pick',{id:flight.id,cup:n});
        if(panel!==activePanel)return;const pick=data.pick;
        const image=new Image();image.src='/assets/bar/ui/'+art(pick.flight.cups[n-1])+'.svg';
        await Promise.all([image,...b.querySelectorAll('.bf-smoke img')].map(img=>img.decode().catch(()=>{})));
        if(panel!==activePanel)return;
        flight=pick.flight;options.onChange?.(flight);b.classList.add('is-fresh');
        // Smoke clears around the empty cup first. Keep geometry fixed through the pour.
        await pause(1350);if(panel!==activePanel)return;
        paint(b,pick.flight.cups[n-1],true);
        await pause(900);if(panel===activePanel){paint(b,pick.flight.cups[n-1]);box.style.height='';result(pick);}
      }catch(e){if(!panel)return;box.style.height='';b.classList.remove('is-smoking');busy=false;if(flight)body();else close();const again=panel?.querySelector('.bf-note');if(again)again.textContent=e.message;}
    }
    function result(pick){
      busy=false;revealed=pick;
      const box=panel.querySelector('.bf-box');box.querySelector('.bf-note')?.remove();box.querySelector('.bf-menu')?.remove();box.querySelector('.bf-head h2').textContent='揭晓';
      const card=el('section','bf-result');card.setAttribute('aria-live','polite');
      card.append(el('h3','',pick.prank?'你的任务':pick.name));
      if(pick.prank)card.append(el('p','bf-prank',pick.prank));
      else card.append(el('p','bf-safe','白水。这一杯没事。'));
      const go=button('bf-go','带着这一杯去找 Ta',close);card.append(go);box.append(card);go.focus({preventScroll:true});
    }
    async function open(){
      if(panel||opening)return;opening=true;const version=++openVersion;focusBefore=doc.activeElement;
      try{await refresh();if(version!==openVersion||panel)return;
        if(!flight){options.onEmpty?.();return;}
        panel=el('div','bf-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','盲品');
        const shade=el('div','bf-shade');shade.onclick=()=>{if(!busy)close();};panel.append(shade,el('div','bf-box'));
        panel.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy){e.preventDefault();close();}});
        // Sit just above the bar strip wherever the composer has pushed it.
        const anchor=options.anchor?.();if(anchor){const top=anchor.getBoundingClientRect().top;if(top>200)panel.style.setProperty('--bf-bottom',Math.round(root.innerHeight-top+14)+'px');}
        (options.host||doc.body).append(panel);body();panel.querySelector('.bf-cup:not(:disabled),.bf-close').focus({preventScroll:true});
      }finally{if(version===openVersion)opening=false;}
    }
    function review(pick){
      if(panel||opening)return;focusBefore=doc.activeElement;revealed=null;
      panel=el('div','bf-panel bf-review');panel.setAttribute('role','dialog');panel.setAttribute('aria-label',pick.cup+'号杯 · '+(pick.prank?'任务':'白水'));
      const shade=el('div','bf-shade');shade.onclick=close;
      const box=el('div','bf-box'),head=el('header','bf-head');
      head.append(el('p','bf-kicker','— blind flight —'),el('h2','',pick.cup+'号杯 · '+(pick.prank?'任务':'白水')));
      const x=button('bf-close','×',close);x.setAttribute('aria-label','关闭任务');head.append(x);
      box.append(head,el('p',pick.prank?'bf-prank':'bf-safe',pick.prank||'白水。这一杯没事。'),button('bf-go','知道了',close));
      panel.append(shade,box);panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
      (options.host||doc.body).append(panel);x.focus({preventScroll:true});
    }
    return {open,close,refresh,start,review,flight:()=>flight};
  }
  const api={create,stripText,tone,art,carryText,encode,decode};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MamoBarFlight=api;
})(typeof window!=='undefined'?window:globalThis);
