/* Preview-ready UI, side effects delegated to onCarry. */
(function(root){
 'use strict';
 const A='/assets/bar/ui/';
 const ASSETS={truth:A+'game-truth.svg',dare:A+'game-dare.svg',swap:A+'game-swap.svg'};
 // Preserve the exported arch; extend only the straight middle with the content.
 let resultTemplate;
 async function resultArt(box){
  resultTemplate ||= fetch(A+'game-result-frame.svg').then(r=>{if(!r.ok)throw Error('Result frame');return r.text();}).catch(e=>{resultTemplate=null;throw e;});
  const svg=new DOMParser().parseFromString(await resultTemplate,'image/svg+xml').documentElement;
  if(!box.isConnected)return;
  svg.classList.add('gg-result-art');svg.setAttribute('aria-hidden','true');svg.removeAttribute('style');box.prepend(svg);
  const contour=svg.querySelector('#result-contour'),original=contour.getAttribute('d');
  const resize=()=>{const h=box.clientHeight;svg.setAttribute('viewBox',`6 2 290 ${h}`);contour.setAttribute('d',original.replaceAll('285.485',String(h-13.488)).replaceAll('300.473',String(h+1.5)));};
  resize();box.classList.add('gg-art-ready');const observer=new ResizeObserver(resize);observer.observe(box);box._disposeArt=()=>observer.disconnect();
 }
 const NAMES={drink:'喝一杯',truth:'真心话',dare:'大冒险',custom:'自定义'};
 const HANDS=['✊','✋','✌️'],HAND_NAMES=['石头','布','剪刀'];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;};
 const btn=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=e=>{if(fn){root.MamoBarAudio?.buttonCue(b,text);return fn.call(b,e);}};return b;};
 const pic=(src,cls='',alt='')=>{const i=el('img',cls);i.src=src;i.alt=alt;return i;};
 const art=(name,cls='')=>pic(A+name+'.svg',cls);
 function drinkPic(drink){if(!drink)return pic(A+'game-empty-cup.svg','gg-empty-cup','待选酒');const i=pic('/assets/bar/'+encodeURIComponent(drink.name.replace(/[:/\\?*"<>|]/g,'-'))+'.png','gg-drink-art',drink.name);i.onerror=()=>{i.onerror=null;i.src='/assets/bar/default.svg';};return i;}
 function create(options={}){
  const screen=el('section','bar-screen gg-screen');screen.hidden=true;screen.tabIndex=-1;screen.setAttribute('aria-label','吧台游戏');screen.setAttribute('role','dialog');screen.setAttribute('aria-modal','true');document.body.append(screen);
  let menu=[],wager={type:'drink',drink:null,custom:''},kind='dice',modes={dice:1,hands:1},game=null,layout,content,footer,modal=null,focusBefore=null,inerts=[],dice=[],busy=false,choice=null,epoch=0,view='setup',modalFocus=null,pools={truth:[],dare:[]},shownTruths=[],bankText='',factoryText='';
  const soundedResults=new WeakSet();
  const reduced=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const randomInt=options.bankRandom||root.MamoBarGameEngine.randomInt;
  // The bank is a convenience; without it the blank question box still works.
  // 真心话 = 你问 Ta 的；大冒险 = 你让 Ta 做的。两段各自一池，亲密段跟同一个开关。
  const BANKS={truth:'真心话',dare:'大冒险'};
  function loadPools(){for(const k in BANKS){const on=root.MamoBarBank.intimate();pools[k]=root.MamoBarBank.pool(bankText,BANKS[k],on);if(!pools[k].length&&factoryText)pools[k]=root.MamoBarBank.pool(factoryText,BANKS[k],on);}}
  async function loadTruths(){try{const r=await (options.fetch||root.fetch)('/barfile?which=questions');const d=await r.json();bankText=d.text||'';factoryText=d.factory||'';loadPools();}catch(e){bankText='';loadPools();}if(!screen.hidden&&view==='setup')setup();}
  function destroyDice(){dice.forEach(d=>d.dispose());dice=[];}
  function closeModal(){if(!modal)return;modal.querySelector('.gg-modal')?._disposeArt?.();modal._shade?.remove();modal.remove();modal=null;layout.inert=false;modalFocus?.focus?.({preventScroll:true});}
  function hide(){epoch++;busy=false;wheelUI?.dispose();destroyDice();closeModal();screen.hidden=true;inerts.forEach(([n,v])=>n.inert=v);inerts=[];focusBefore?.focus?.({preventScroll:true});}
  function shell(title,subtitle,arch=false,back=setup){
   epoch++;wheelUI?.dispose();destroyDice();closeModal();screen.replaceChildren();layout=el('div','bar-layout gg-layout'+(arch?' gg-arch':' gg-flat'));
   layout.append(el('div','bar-frame'));const header=el('header','gg-header');
   const b=btn('',back,'bar-back');b.setAttribute('aria-label',view==='setup'?'返回酒单':'返回游戏');b.append(art('back-arrow'));header.append(b);
   if(arch){const star=el('div','bar-star');for(const [name,cls]of [['star-base','bar-star-base'],['star-lines','bar-star-lines'],['star-ne','bar-star-ray bar-star-ne'],['star-se','bar-star-ray bar-star-se'],['star-nw','bar-star-ray bar-star-nw'],['star-sw','bar-star-ray bar-star-sw']])star.append(art(name,cls));header.append(star);}
   header.append(el('h1','gg-title',title));if(subtitle)header.append(el('p','gg-subtitle',subtitle));
   layout.append(header);content=el('div','gg-content');footer=el('footer','gg-footer');layout.append(content,footer);screen.append(layout);return header;
  }
  function hex(text,fn,primary=true){return btn(text,fn,'gg-hex'+(primary?' primary':''));}
  let carriedWheel=null;
  function wheelReveal(text,payload){
   const box=dialog('gg-result gg-tie ww-reveal');box.setAttribute('aria-label','轮盘揭晓');
   box.append(el('p','gg-result-kicker','— 揭晓 —'),el('h2','','轮盘结果'),el('p','ww-reveal-text',text));
   const actions=el('div','gg-actions');actions.append(hex('取消',closeModal,false),hex('带着结果去找Ta',()=>{carriedWheel=payload;hide();options.onCarry?.({...payload});}));box.append(actions);
   resultArt(box).catch(()=>box.classList.add('gg-frame-error'));
  }
  let underlineGroup=null;
  function animateUnderline(node,group){if(underlineGroup===group){node.classList.add('gg-animate-underline');underlineGroup=null;}}
  const wheelUI=root.MamoBarWheel?.create({reveal:wheelReveal,lock:value=>busy=value,hex,shell(title,subtitle,back){view='wheel';const header=shell(title,subtitle,false,title==='THE GAMES'?setup:back);return {header,content,footer,layout};},tabs(header,show){const tabs=el('div','gg-tabs');const table=btn('赌桌',()=>{underlineGroup='tabs';setup();});table.append(el('em','','the table'));const wheel=btn('轮盘',null,'selected');wheel.append(el('em','','the wheel'));wheel.setAttribute('aria-current','page');tabs.append(table,wheel);animateUnderline(tabs,'tabs');header.append(tabs);}});
  function heading(text){const h=el('div','bar-heading-line gg-heading');h.append(art('flourish'),el('h2','',text),art('flourish'));return h;}
  function wagerArt(){if(wager.type==='drink')return drinkPic(wager.drink);if(wager.type==='custom')return el('div','gg-note-mini',wager.custom||'写下这一轮的赌注');return pic(ASSETS[wager.type],'gg-card-art',NAMES[wager.type]);}
  function dialog(cls=''){closeModal();modalFocus=document.activeElement;modal=el('div','gg-overlay');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;const shade=el('div','gg-shade');shade.setAttribute('aria-hidden','true');modal._shade=shade;const box=el('section','gg-modal '+cls);modal.append(box);screen.append(shade,modal);layout.inert=true;modal.focus({preventScroll:true});return box;}
  function setup(){
   view='setup';busy=false;const header=shell('THE GAMES','',false,()=>{hide();options.onClose?.();});
   const guide=btn('',showGuide,'bar-edit-link gg-guide-link');guide.setAttribute('aria-label','游戏玩法说明');guide.append(art('guide'),el('span','','guide'));header.append(guide);
   const tabs=el('div','gg-tabs');const table=btn('赌桌',null,'selected');table.append(el('em','','the table'));table.setAttribute('aria-current','page');const wheel=btn('轮盘',()=>{underlineGroup='tabs';wheelUI?.show();});wheel.append(el('em','','the wheel'));tabs.append(table,wheel);animateUnderline(tabs,'tabs');header.append(tabs);
   content.append(heading('这一轮的赌注'));
   const board=el('div','gg-wager-board');const grid=el('div','gg-wagers');board.append(grid);
   for(const type of ['drink','truth','dare','custom']){
    const tile=el('div','gg-wager'+(wager.type===type?' selected':''));
    const select=btn('',()=>{if(type==='custom'){root.MamoBarAudio?.play('select');customNote();return;}if(wager.type!==type)root.MamoBarAudio?.play('select');wager.type=type;setup();},'gg-wager-select');select.setAttribute('aria-label',NAMES[type]);select.setAttribute('aria-pressed',String(wager.type===type));
    if(type==='drink'){const change=btn('',()=>pickDrink(),'gg-change');change.append(pic(ASSETS.swap));change.setAttribute('aria-label','换酒');tile.append(change);const im=btn('',()=>pickDrink(),'gg-wager-picture');im.setAttribute('aria-label',wager.drink?'换酒：'+wager.drink.name:'选择一杯酒');im.append(pic(A+'flight-cup-empty.svg','gg-wager-cup','喝一杯'));tile.append(im);}
    else {const im=el('span','gg-wager-picture');im.append(type==='custom'?el('span','gg-note-mini',wager.custom||'输的人今晚洗碗……'):pic(ASSETS[type],'gg-card-art',NAMES[type]));select.append(im);}
    select.append(el('strong','',NAMES[type]),el('small','',type==='drink'?(wager.drink?'醉意 + '+Number(wager.drink.std).toFixed(1):'选一杯作为赌注'):type==='truth'?(pools.truth.length?pools.truth.length+' 道题，输的人答':'输的人答一个'):type==='dare'?(pools.dare.length?pools.dare.length+' 道题，输的人做':'输的人做一件'):'写一句'));tile.append(select);grid.append(tile);
   }
   const ornament=el('span','gg-cross');ornament.append(art('footer-star'));grid.append(ornament);content.append(board,heading('怎么分胜负'));
   const games=el('div','gg-kind');for(const [value,label,en,symbol] of [['dice','骰子 · 比大小','dice','⚄'],['hands','猜拳','hands','✊']]){const b=btn('',()=>{if(kind===value)return;root.MamoBarAudio?.play('select');kind=value;underlineGroup='kind';setup();},value===kind?'selected':'');b.setAttribute('aria-pressed',String(value===kind));b.append(el('span','gg-kind-icon',symbol),el('span','',label),el('em','',en));games.append(b);}animateUnderline(games,'kind');content.append(games);
   footer.append(hex('开局 · '+(kind==='dice'?'掷骰':'猜拳'),()=>{if(wager.type==='drink'&&!wager.drink){pickDrink();return;}root.MamoBarAudio?.play('start');start();}));
  }
  function pickDrink(){
   view='picker';shell('PICK A DRINK','选一杯作为赌注',true,setup);layout.classList.add('gg-picker-layout');content.classList.add('gg-picker');for(const side of ['left','right']){const corner=el('span','bar-header-corner '+side);corner.append(art('header-corners'));layout.querySelector('.gg-header').append(corner);}let selected=wager.drink;
   const groups=[...new Set(menu.map(i=>i.group))];
   for(const group of groups){content.append(heading(group));const en=el('em','gg-group-en',root.MamoBarUI.groupEnglish(group));content.append(en);const grid=el('div','gg-drink-grid');for(const item of menu.filter(i=>i.group===group)){
    const b=btn('',()=>{if(selected!==item)root.MamoBarAudio?.play('select');selected=item;content.querySelectorAll('.gg-drink-choice').forEach(n=>{n.classList.remove('selected');n.setAttribute('aria-pressed','false');});b.classList.add('selected');b.setAttribute('aria-pressed','true');confirm.disabled=false;},'gg-drink-choice'+(selected?.name===item.name?' selected':''));b.setAttribute('aria-pressed',String(selected?.name===item.name));b.append(drinkPic(item));const copy=el('span','bar-drink-copy');copy.append(el('span','bar-drink-name',item.name));if(item.name_en)copy.append(el('span','bar-drink-en',item.name_en));copy.append(el('span','bar-drink-std',item.std?'✦ + '+Number(item.std).toFixed(1):'无酒精'));b.append(copy);grid.append(b);
   }content.append(grid);}
   if(!menu.length)content.append(el('p','gg-empty','酒单暂时为空，先来一轮真心话？'));
   const confirm=hex('选这杯',()=>{if(!selected)return;wager.drink={...selected};wager.type='drink';setup();});confirm.disabled=!selected;footer.append(confirm);
  }
  function customNote(){const box=dialog('gg-note-modal');box.append(el('h2','','写下这一轮的赌注'));const input=el('textarea');input.placeholder='输的人……';input.value=wager.custom;input.maxLength=300;input.setAttribute('aria-label','自定义赌注');box.append(input);const actions=el('div','gg-actions');const confirm=hex('用这个作为赌注',()=>{if(!input.value.trim())return;wager.custom=input.value.trim();wager.type='custom';closeModal();setup();});confirm.disabled=!input.value.trim();input.oninput=()=>confirm.disabled=!input.value.trim();actions.append(hex('取消',closeModal,false),confirm);box.append(actions);}
  function showGuide(){
   view='guide';shell('GAME GUIDE','游戏指南',false,setup);content.classList.add('gg-guide');
   const paragraphs=[['先约好赌注','选喝一杯、真心话、大冒险，或写下自己的赌注。点酒图或左上角换酒按钮，可以重新挑一杯。'],['骰子 · 比大小','单掷：双方各投一次，大者胜。三掷：点三次投掷，双方累计三次点数，总分高者胜。每次上下骰子同时掷出，朝上的一面是本次点数。'],['猜拳','先选石头、剪刀或布，再点「选定出手」，双方手势同时揭晓。一局定输赢，或选择三局两胜：先赢两次的一方获胜，平手后继续出拳。'],['平局，再来一轮','平局卡点「再来一轮」，回到当前玩法，分数清零，按刚才的模式重新开始。'],['赢家来出题','真心话、大冒险在分出胜负后出题。你赢了，就在结算卡写问题或任务；真心话、大冒险都会从各自的题库里随机亮三道给你挑，点「换一批」再换三道，也可以自己写；「亲密题」开关默认关着，打开后题库里「亲密」那一段才会进来（盲品那边也认这个开关）；题库在酒单的 edit 里改；Ta 赢了，就把结果记下，回你们聊天的地方由 Ta 出题。自定义赌注按开局前写好的约定兑现。'],['带着结果找 Ta','结果卡可以先收起，稍后在桌面点「查看结果」。点「带着结果找 Ta」会把结果记进首页「今晚的记录」，Ta 用「看吧台」就能看到。'],['愿赌服输','押好的酒由输家喝。Ta 输了押的酒，记下结果的那一刻就替 Ta 喝掉，醉意以酒单数值和吧台上限为准；Ta 在聊天里接着回应。平常点酒由 Ta 决定接下还是推回。']];
   for(const [h,p]of paragraphs){const s=el('section');s.append(el('h2','',h),el('p','',p));content.append(s);}footer.append(hex('回到赌桌',setup));
  }
  function start(){game=root.MamoBarGameEngine.create({kind,mode:modes[kind],wager,random:options.random});choice=null;busy=false;table();}
  function number(value){const outer=el('span','gg-number');outer.classList.toggle('single-digit',value<10);outer.setAttribute('aria-label',String(value));for(const ch of String(value).padStart(2,' ')){const slot=el('span','gg-digit');const strip=el('span','gg-digit-strip');for(let i=0;i<10;i++)strip.append(el('span','',String(i)));strip.style.transform='translateY(-'+(ch===' '?0:Number(ch)*10)+'%)';if(ch===' ')slot.classList.add('blank');slot.append(strip);outer.append(slot);}return outer;}
  function updateNumber(n,value){n.setAttribute('aria-label',String(value));n.classList.toggle('single-digit',value<10);String(value).padStart(2,' ').split('').forEach((ch,i)=>{const slot=n.children[i];slot.classList.toggle('blank',ch===' ');slot.firstChild.style.transform='translateY(-'+(ch===' '?0:Number(ch)*10)+'%)';});}
  function table(){
   view='table';shell('THE TABLE',kind==='dice'?'骰子 · 比大小':'猜拳',true,()=>{if(busy)return;setup();});const version=epoch;
   const switches=el('div','gg-mode');switches.setAttribute('role','group');switches.setAttribute('aria-label','选择游戏模式');switches.style.setProperty('--mode-index',game.state.mode===1?0:1);
   const switchMode=mode=>{if(busy||modes[kind]===mode)return;root.MamoBarAudio?.play('select');busy=true;switches.style.setProperty('--mode-index',mode===1?0:1);[...switches.children].forEach((b,i)=>{b.classList.toggle('selected',i===(mode===1?0:1));b.setAttribute('aria-pressed',String(i===(mode===1?0:1)));});const play=footer.querySelector('.gg-play');if(play)play.disabled=true;setTimeout(()=>{if(version!==epoch)return;modes[kind]=mode;start();},reduced()?0:220);};
   for(const mode of [1,3]){const b=btn(kind==='dice'?(mode===1?'单掷':'三掷'):(mode===1?'一局定输赢':'三局两胜'),()=>switchMode(mode),game.state.mode===mode?'selected':'');b.setAttribute('aria-pressed',String(game.state.mode===mode));switches.append(b);}
   let dragX=null;switches.addEventListener('pointerdown',e=>{if(!busy)dragX=e.clientX;});switches.addEventListener('pointerup',e=>{if(dragX===null)return;const dx=e.clientX-dragX;dragX=null;if(Math.abs(dx)>18){e.preventDefault();switchMode(dx>0?3:1);}});switches.addEventListener('pointercancel',()=>dragX=null);
   switches.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();switchMode(e.key==='ArrowRight'?3:1);}});layout.querySelector('.gg-header').append(switches);
   content.classList.add('gg-table',kind==='dice'?'gg-dice-table':'gg-hands-table');
   const last=game.state.rounds.at(-1);const scoreNodes={};
   for(const who of ['ta','me']){
    if(who==='me'){const stake=el('div','gg-stake');const circle=el('div','gg-stake-circle');circle.append(wagerArt());stake.append(circle);content.append(stake);}
    const player=el('div','gg-player '+who);
    if(kind==='dice'){const stage=el('div','gg-dice-stage');stage.setAttribute('aria-label',(who==='ta'?'Ta':'我')+'的骰子');player.append(stage);root.MamoDice.create(stage).then(d=>{if(version!==epoch){d.dispose();return;}dice.push(d);d.who=who;d.set(last?.[who]||1);ready();}).catch(()=>{if(version!==epoch)return;stage.textContent='骰子载入失败';action.textContent='重新载入';action.disabled=false;action.onclick=table;});
     const score=el('div','gg-score');scoreNodes[who]=number(game.state[who]);score.append(el('span','',who==='ta'?'Ta 总计':'我 总计'),scoreNodes[who],el('span','','点'));player.append(score);
    }else{const row=el('div','gg-hand-row');row.append(el('span','',who==='ta'?'Ta':'我'),el('span','gg-revealed-hand',last?HANDS[last[who]]:'—'),el('span','gg-hand-name',last?HAND_NAMES[last[who]]:''));player.append(row);}
    content.append(player);
   }
   let choices;
   if(kind==='hands'){
    choices=el('div','gg-hands-choices');for(const hand of [0,2,1]){const b=btn(HANDS[hand],()=>{if(busy||game.state.done)return;if(choice!==hand)root.MamoBarAudio?.play('select');choice=hand;choices.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));action.disabled=false;},'gg-hand-choice');b.setAttribute('aria-label',HAND_NAMES[hand]);b.setAttribute('aria-pressed','false');b.disabled=game.state.done;choices.append(b);}content.append(choices);
    const score=el('div','gg-match-score');for(const who of ['ta','me']){const p=el('div');p.append(el('span','',who==='ta'?'Ta':'我'));scoreNodes[who]=number(game.state[who]);p.append(scoreNodes[who]);score.append(p);}content.append(score);
   }
   const progress=el('p','gg-progress',kind==='dice'&&game.state.mode===3?game.state.rounds.length+' / 3':'');progress.setAttribute('aria-live','polite');footer.append(progress);
   const action=hex(game.state.done?'查看结果':kind==='dice'?'投掷':'选定出手',()=>game.state.done?settlement():play());action.classList.add('gg-play');action.disabled=!game.state.done;footer.append(action);
   function ready(){if(kind==='dice'&&dice.length===2&&!busy)action.disabled=false;}
   async function play(){
    if(busy||game.state.done||kind==='hands'&&choice===null)return;
    root.MamoBarAudio?.prepare();busy=true;action.disabled=true;switches.querySelectorAll('button').forEach(b=>b.disabled=true);choices?.querySelectorAll('button').forEach(b=>b.disabled=true);layout.querySelector('.bar-back').disabled=true;
    const roll=game.play(choice);action.textContent=kind==='dice'?'投掷中':'出手中';
    if(kind==='dice')await Promise.all(dice.map(d=>d.roll(roll[d.who])));
    else{content.classList.add('revealing');await new Promise(r=>setTimeout(r,reduced()?0:550));if(version!==epoch)return;content.classList.remove('revealing');for(const who of ['ta','me']){const p=content.querySelector('.gg-player.'+who);p.querySelector('.gg-revealed-hand').textContent=HANDS[roll[who]];p.querySelector('.gg-hand-name').textContent=HAND_NAMES[roll[who]];}}
    if(version!==epoch)return;updateNumber(scoreNodes.me,game.state.me);updateNumber(scoreNodes.ta,game.state.ta);progress.textContent=kind==='dice'&&game.state.mode===3?game.state.rounds.length+' / 3':kind==='hands'&&roll.winner==='tie'&&!game.state.done?'平手 · 继续出拳':'';
    await new Promise(r=>setTimeout(r,game.state.done?1500:650));if(version!==epoch)return;busy=false;choice=null;layout.querySelector('.bar-back').disabled=false;switches.querySelectorAll('button').forEach(b=>b.disabled=false);action.textContent=game.state.done?'查看结果':kind==='dice'?'投掷':'选定出手';action.disabled=kind==='hands'&&!game.state.done;choices?.querySelectorAll('button').forEach(b=>{b.disabled=game.state.done;b.setAttribute('aria-pressed','false');});
    if(game.state.done)settlement(true);
   }
  }
  function settlement(announce=false){
   const state=game.state;if(!state.done)return;
   if(announce&&!soundedResults.has(state)){soundedResults.add(state);if(state.winner==='me')root.MamoBarAudio?.play('success');else if(state.winner==='ta')root.MamoBarAudio?.play('failure');}
   const tie=state.winner==='tie';const box=dialog('gg-result'+(tie?' gg-tie':'')+(wager.type==='custom'?' gg-custom-result':''));box.setAttribute('aria-label','游戏结算');box.append(el('p','gg-result-kicker','— 结算 —'),el('h2','',tie?'平局':NAMES[wager.type]+' · '+(state.winner==='me'?'你赢了':'Ta 赢了')));
   if(!tie){const image=el('div','gg-result-picture');image.append(wagerArt());box.append(image);}
   const score=el('div','gg-result-score');for(const who of ['ta','me']){const row=el('div');row.append(el('span','',who==='ta'?'Ta':'你'),number(state[who]),el('span','',kind==='dice'?'点':'胜'));score.append(row);}box.append(score);
   const needsQuestion=!tie&&state.winner==='me'&&['truth','dare'].includes(wager.type);
   let input;
   if(needsQuestion){box.append(el('p','gg-question-heading','给 Ta 出题'));const label=el('label','gg-question-label',wager.type==='truth'?'写下你想问 Ta 的问题':'写下你想要 Ta 做的事');input=el('textarea');input.maxLength=500;input.value=state.question;input.setAttribute('aria-label',label.textContent);label.append(input);
    const pool=pools[wager.type]||[];
    if(pool.length){
     const bank=el('div','gg-bank');bank.setAttribute('role','group');bank.setAttribute('aria-label','从题库里挑一道');
     const deal=()=>{shownTruths=root.MamoBarBank.draw(pools[wager.type],3,randomInt,shownTruths);bank.replaceChildren();
      for(const q of shownTruths){const b=btn('',()=>{input.value=q.text;input.dispatchEvent(new Event('input'));bank.querySelectorAll('.gg-bank-item').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));},'gg-bank-item');b.setAttribute('aria-pressed',String(input.value===q.text));b.append(el('span','',q.text));/* 只有题，不标档位（他自己看得出来） */bank.append(b);}
      const tools=el('div','gg-bank-tools');
      // 亲密池开关：每台设备自己记，盲品那边读同一个开关。
      tools.append(root.MamoBarBank.createSwitch(()=>{loadPools();shownTruths=[];deal();}));
      if(pools[wager.type].length>3)tools.append(btn('换一批',deal,'gg-bank-more'));bank.append(tools);};
     deal();box.append(bank);label.firstChild.textContent='挑一道，或者自己写';input.setAttribute('aria-label',wager.type==='truth'?'写下你想问 Ta 的问题':'写下你想要 Ta 做的事');
    }
    box.append(label);}
   else if(!tie&&wager.type!=='custom'){const caption=wager.type==='drink'?(state.winner==='me'?'这杯 '+wager.drink.name+'，愿赌服输。':'这杯 '+wager.drink.name+'，轮到你了。'):(wager.type==='truth'?'回去听听 Ta 想问什么。':'回去看看 Ta 会出什么题。');box.append(el('p','gg-result-caption',caption));}
   const actions=el('div','gg-actions');const go=hex(tie?'再来一轮':'带着结果找 Ta',()=>{if(tie){game=game.restart();choice=null;closeModal();table();return;}if(input)state.question=input.value;const payload=game.payload();carriedWheel=null;hide();options.onCarry?.(payload);});
   if(input){go.disabled=!input.value.trim();input.oninput=()=>{state.question=input.value;go.disabled=!input.value.trim();};}
   actions.append(hex('收起',closeModal,false),go);box.append(actions);resultArt(box).catch(()=>box.classList.add('gg-frame-error'));
  }
  screen.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(modal){root.MamoBarAudio?.play('back');closeModal();}else if(!busy){root.MamoBarAudio?.play('back');if(view==='setup'){hide();options.onClose?.();}else setup();}}if(e.key==='Tab'){const scope=modal||screen;const list=[...scope.querySelectorAll('button:not(:disabled),textarea,input,[tabindex="0"]')].filter(n=>n.getClientRects().length&&!n.closest('[inert]'));if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===scope)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===scope)){e.preventDefault();first.focus();}}});
return {open(def={}){menu=def.menu||[];shownTruths=[];loadTruths();wager={type:'drink',drink:null,custom:''};game=null;carriedWheel=null;choice=null;if(screen.hidden){focusBefore=document.activeElement;inerts=[...document.body.children].filter(n=>n!==screen&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE').map(n=>[n,n.inert]);inerts.forEach(([n])=>n.inert=true);}screen.hidden=false;screen.focus();setup();},hide,resume(payload){if(payload){const p=JSON.parse(JSON.stringify(payload));carriedWheel=p.kind==='wheel'?p:null;if(!carriedWheel){kind=p.kind;wager=p.wager;modes[kind]=p.mode;game=root.MamoBarGameEngine.create({kind,mode:p.mode,wager});Object.assign(game.state,p);}}focusBefore=document.activeElement;screen.hidden=false;inerts=[...document.body.children].filter(n=>n!==screen&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE').map(n=>[n,n.inert]);inerts.forEach(([n])=>n.inert=true);if(carriedWheel){wheelUI.show();wheelReveal(carriedWheel.result,carriedWheel);}else{table();settlement();}},getState:()=>game?.state};
 }
 root.MamoBarGames={create};
})(window);
