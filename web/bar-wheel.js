/* Local preview wheel. Fixed lighting, independently rotating face and medallion. */
(function(root){
 'use strict';
 const A='/assets/bar/ui/',KEY='bar.wheel.v1';
 const themes=[
  {name:'暖酿',colors:['#F6EBD9','#8E3B2C','#D9A054','#E8D2B5','#E0762F','#7E8B5E']},
  {name:'晴日',colors:['#F6F1E7','#849EBE','#F7C424','#BDBA16','#3C6078','#DFC9AC']}
 ];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;};
 const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=e=>{if(fn){root.MamoBarAudio?.buttonCue(b,text);return fn.call(b,e);}};return b;};
 const image=(name,cls)=>{const i=el('img',cls);i.src=A+'wheel-'+name;i.alt='';i.draggable=false;return i;};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const colorAt=(theme,index)=>index%2?theme.colors[0]:theme.colors[1+Math.floor(index/2)%(theme.colors.length-1)];
 const defaults=()=>[
  {theme:0,cells:['变身小猫1h','真心话','大冒险','喝一杯','禁欲24h','再转一次'].map((text,i)=>({text,color:['#F6EBD9','#E8D2B5','#F6EBD9','#D9A054','#F6EBD9','#8E3B2C'][i]}))},
  {theme:1,cells:['一起散步','挑一首歌','分享今天','夸夸对方','一起看电影','再转一次'].map((text,i)=>({text,color:colorAt(themes[1],i)}))}
 ];
 function valid(x){return Array.isArray(x)&&x.length===4&&x.every(s=>Number.isInteger(s.theme)&&themes[s.theme]&&Array.isArray(s.cells)&&s.cells.length>=3&&s.cells.length<=12&&s.cells.every(c=>typeof c.text==='string'&&c.text.trim()&&c.text.length<=24&&/^#[\da-f]{6}$/i.test(c.color)));}
 function create(host){
  let sets=defaults(),selected=0,preset=0,drafts=null,stop=()=>{},result=Array(4).fill('还没转');sets.push(clone(sets[1]),clone(sets[1]));const current=()=>selected?preset+1:0;try{const saved=JSON.parse(localStorage.getItem(KEY));if(Array.isArray(saved)){const oldColors=['#EEF0F6','#C5CEDD','#7D9DB8','#9686B0','#565E7A','#8E969F','#F2F0DF','#D5DCBF','#A9B58C','#7E9476','#526A59','#B6A078'];for(const set of saved){if(set?.theme===1||set?.theme===2){set.theme=1;for(const c of set.cells||[]){const i=oldColors.indexOf(c.color?.toUpperCase());if(i>=0)c.color=themes[1].colors[i%6];}}}}if(Array.isArray(saved)&&saved.length===2)saved.push(clone(defaults()[1]),clone(defaults()[1]));if(valid(saved))sets=saved;}catch{}
  sets.forEach((s,i)=>{if(typeof s.name!=='string'||!s.name.trim())s.name=i?['预设一','预设二','预设三'][i-1]:'吧台轮盘';});
  let savedPreset=0;try{const p=Number(localStorage.getItem(KEY+'.active'));if(Number.isInteger(p)&&p>=0&&p<3)savedPreset=p;}catch{}preset=savedPreset;
  function dispose(){stop();stop=()=>{};host.lock(false);}
  function show(){
   preset=savedPreset;dispose();const {header,content,footer,layout}=host.shell('THE GAMES','',show);layout.classList.add('ww-layout');host.tabs(header,show);
   const controls=el('div','ww-controls'),mode=el('div','gg-mode ww-mode');mode.style.setProperty('--mode-index',selected);
   const switchTo=i=>{if(i===selected||layout.inert)return;root.MamoBarAudio?.play('select');host.lock(true);mode.style.setProperty('--mode-index',i);layout.inert=true;const timer=setTimeout(()=>{selected=i;show();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:220);const previous=stop;stop=()=>{clearTimeout(timer);previous();};};
   ['吧台轮盘','定制轮盘'].forEach((name,i)=>{const b=button(name,()=>switchTo(i),i===selected?'selected':'');b.setAttribute('aria-pressed',String(i===selected));mode.append(b);});
   let down;mode.onpointerdown=e=>down=e.clientX;mode.onpointerup=e=>{if(down!=null&&Math.abs(e.clientX-down)>18)switchTo(e.clientX>down?1:0);down=null;};mode.onpointercancel=()=>down=null;
   mode.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();switchTo(e.key==='ArrowRight'?1:0);}};
   const edit=button('',()=>editor(false),'bar-edit-link ww-edit '+(selected?'right':'left'));edit.setAttribute('aria-label','编辑'+(selected?'定制':'吧台')+'轮盘');const editIcon=el('img');editIcon.src=A+'edit.svg';editIcon.alt='';edit.append(editIcon,el('span','','edit'));controls.append(edit,mode);content.append(controls);const name=el('p','ww-preset-name',selected?sets[current()].name:'\u00a0');if(!selected)name.setAttribute('aria-hidden','true');else name.title=sets[current()].name;content.append(name);
   const assembly=el('div','ww-assembly'),wheel=el('div','ww-wheel'),face=el('div','ww-face'),shade=el('div','ww-shade'),hub=el('div','ww-hub'),hubRotor=el('div','ww-hub-rotor');
   assembly.append(image('base.svg','ww-base'));wheel.append(face,shade,hub);hub.append(hubRotor);const hubInner=el('span','ww-center-art');hubRotor.append(hubInner);hub.append(el('span','ww-pin'));assembly.append(wheel,image('pointer.svg','ww-pointer'),image('ornament.svg','ww-ornament'));content.append(assembly);
   const set=sets[current()],n=set.cells.length,step=360/n;const gradient='conic-gradient('+set.cells.map((c,i)=>`${c.color} ${i*step}deg ${(i+1)*step}deg`).join(',')+')';face.style.background=gradient;const base=themes[set.theme].colors[0],accents=[...new Set(set.cells.map(c=>c.color.toUpperCase()))].filter(c=>c!==base.toUpperCase()).slice(0,3);if(!accents.length)accents.push(base);const six=Array.from({length:6},(_,i)=>i%2?base:accents[Math.floor(i/2)%accents.length]);const hubGradient='conic-gradient('+six.map((c,i)=>`${c} ${i*60}deg ${(i+1)*60}deg`).join(',')+')';hubRotor.style.background=hubGradient;hubInner.style.background=hubGradient;hubRotor.dataset.colors=JSON.stringify(six);
   set.cells.forEach((c,i)=>{const a=(i+.5)*step,r=a*Math.PI/180,label=el('span','ww-label',c.text);label.style.left=(50+37*Math.sin(r))+'%';label.style.top=(50-37*Math.cos(r))+'%';label.style.transform=`translate(-50%,-50%) rotate(${a}deg)`;label.style.maxWidth=(n>8?48:80)+'px';label.style.fontSize=(n>8?10:12)+'px';const rgb=c.color.match(/\w\w/g).map(x=>parseInt(x,16));label.style.color=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114<140?'#FBF8F1':'#4A3F35';face.append(label);});
   const answer=el('div','ww-result');answer.append(el('small','','结果'));const text=el('p','',result[current()]);text.setAttribute('aria-live','polite');answer.append(text);content.append(answer);
   const play=host.hex('转一下',spin);play.classList.add('gg-play');footer.append(play);let spinning=false,raf=0,angle=0,revealTimer=0;stop=()=>{cancelAnimationFrame(raf);clearTimeout(revealTimer);spinning=false;};
   function spin(){if(spinning)return;clearTimeout(revealTimer);spinning=true;host.lock(true);layout.querySelectorAll('button').forEach(b=>b.disabled=true);play.textContent='转动中';text.textContent='转动中';
    const limit=Math.floor(4294967296/n)*n,u=new Uint32Array(1);do{crypto.getRandomValues(u);}while(u[0]>=limit);const index=u[0]%n;crypto.getRandomValues(u);const fraction=.002+(u[0]/4294967296)*.996,target=angle+360*5+((360-(index+fraction)*step-angle%360+360)%360),start=angle,t0=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:4200;
    const render=a=>{face.style.transform=`rotate(${a}deg)`;hubRotor.style.transform=`rotate(${-a*.75}deg)`;};
    function frame(now){const t=duration?Math.min(1,(now-t0)/duration):1;let a;if(t<.88){const p=t/.88;a=start+(target+2.5-start)*(1-Math.pow(1-p,4));}else{const p=(t-.88)/.12;a=target+2.5*Math.exp(-5*p)*Math.cos(p*Math.PI*3);}render(t===1?target:a);if(t<1)raf=requestAnimationFrame(frame);else{angle=target;spinning=false;host.lock(false);layout.querySelectorAll('button').forEach(b=>b.disabled=false);play.textContent='转一下';result[current()]=set.cells[index].text;text.textContent=result[current()];face.dataset.resultIndex=String(index);face.dataset.angle=String(target);const payload={id:crypto.randomUUID(),source:'bar-wheel',kind:'wheel',result:result[current()],wheel:selected?'定制轮盘':'吧台轮盘',presetName:selected?set.name:'',cellIndex:index};revealTimer=setTimeout(()=>host.reveal(payload.result,payload),1500);}}
    raf=requestAnimationFrame(frame);
   }
  }

  function presetSwitch(change,allow=()=>true){
   const control=el('div','gg-mode ww-presets');control.setAttribute('aria-label','定制轮盘预设');control.style.setProperty('--mode-index',preset);
   const select=i=>{if(i===preset||i<0||i>2||!allow())return;root.MamoBarAudio?.play('select');preset=i;change();};
   ['预设一','预设二','预设三'].forEach((name,i)=>{const b=button(name,()=>select(i),i===preset?'selected':'');b.setAttribute('aria-pressed',String(i===preset));control.append(b);});
   let x;control.onpointerdown=e=>x=e.clientX;control.onpointerup=e=>{if(x!=null&&Math.abs(e.clientX-x)>18){select(preset+(e.clientX>x?1:-1));}x=null;};control.onpointercancel=()=>x=null;
   control.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();select(preset+(e.key==='ArrowRight'?1:-1));}};
   return control;
  }
  function editor(keep=false){
   dispose();if(!keep)drafts=clone(sets);
   const draft=drafts[current()],{content,footer,layout}=host.shell('EDIT WHEEL','编辑格子 · '+(selected?'定制轮盘':'吧台轮盘'),show);
   layout.classList.add('ww-editor');
   let editing=null,popup=null,active=-1;
   if(selected)content.append(presetSwitch(()=>editor(true),()=>finishEdit(true)));
   if(selected){
    const label=el('label','ww-name-field','预设名称'),input=el('input');
    input.value=draft.name;input.maxLength=24;input.placeholder=['预设一','预设二','预设三'][preset];input.setAttribute('aria-label','预设名称');
    input.oninput=()=>draft.name=input.value;label.append(input);content.append(label);
   }
   content.append(el('p','ww-hint','点圆圈改色，间色保持同色，盘面更整齐。'));
   const list=el('div','ww-list'),palette=el('div','ww-palette'),actions=el('div','gg-actions');
   content.append(list,el('p','ww-theme-label','默认配色方案'),palette);footer.append(actions);
   function closePalette(){popup?.remove();popup=null;active=-1;list.querySelectorAll('.ww-dot').forEach(b=>b.setAttribute('aria-pressed','false'));}
   function finishEdit(confirm){
    if(!editing)return true;
    const {index,original,added}=editing,c=draft.cells[index];
    if(confirm&&!c.text.trim()){list.querySelectorAll('.ww-row input')[index]?.focus();return false;}
    if(!confirm){if(added)draft.cells.splice(index,1);else c.text=original;}
    else c.text=c.text.trim();
    document.activeElement?.blur();editing=null;drawList();drawActions();return true;
   }
   function drawActions(){
    actions.replaceChildren();actions.classList.toggle('ww-editing-actions',!!editing);
    if(editing){
     const confirm=host.hex('确定',()=>finishEdit(true));confirm.disabled=!draft.cells[editing.index].text.trim();
     actions.append(host.hex('取消',()=>finishEdit(false),false),confirm);return;
    }
    actions.append(host.hex('重置当前盘面颜色',()=>{draft.cells.forEach((c,i)=>c.color=colorAt(themes[draft.theme],i));drawList();drawThemes();},false),
     host.hex('保存',()=>{
      if(draft.cells.some(c=>!c.text.trim()))return;
      drafts.forEach((s,i)=>{s.cells.forEach(c=>c.text=c.text.trim());s.name=s.name.trim()||(i?['预设一','预设二','预设三'][i-1]:'吧台轮盘');});
      sets=clone(drafts);savedPreset=preset;result.fill('还没转');
      try{localStorage.setItem(KEY,JSON.stringify(sets));localStorage.setItem(KEY+'.active',String(savedPreset));}catch{}
      show();
     }));
   }
   function openPalette(i,wrap,dot){
    const was=active===i;closePalette();if(was)return;
    active=i;dot.setAttribute('aria-pressed','true');
    popup=el('div','ww-color-popover');popup.setAttribute('role','group');popup.setAttribute('aria-label','第'+(i+1)+'格色盘');
    const select=color=>{
     draft.cells[i].color=color;dot.style.background=color;
     popup.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color.toLowerCase()===color.toLowerCase())));
    };
    themes.forEach(theme=>{
     const row=el('div','ww-color-row');
     theme.colors.forEach(color=>{
      const sw=button('',()=>select(color),'ww-swatch');sw.style.background=color;sw.dataset.color=color;sw.setAttribute('aria-label',theme.name+' '+color);row.append(sw);
     });popup.append(row);
    });
    const actions=el('div','ww-palette-actions'),custom=el('label','ww-custom-color','点这里自选'),input=el('input');input.type='color';input.value=draft.cells[i].color;input.setAttribute('aria-label','点这里自选');input.oninput=()=>select(input.value);custom.append(input);actions.append(custom,button('确认',()=>{closePalette();dot.focus({preventScroll:true});},'ww-palette-confirm'));popup.append(actions);
    wrap.append(popup);select(draft.cells[i].color);
    const bottom=content.getBoundingClientRect().bottom;if(popup.getBoundingClientRect().bottom>bottom&&wrap.getBoundingClientRect().top-popup.offsetHeight>content.getBoundingClientRect().top)popup.classList.add('above');
   }
   content.addEventListener('pointerdown',e=>{if(!e.target.closest('.ww-color-popover,.ww-dot'))closePalette();});
   function drawList(){
    closePalette();list.replaceChildren();
    draft.cells.forEach((c,i)=>{
     const wrap=el('div','ww-row-wrap'),row=el('div','ww-row'),dot=button('',()=>openPalette(i,wrap,dot),'ww-dot');
     dot.style.background=c.color;dot.setAttribute('aria-label','第'+(i+1)+'格颜色');dot.setAttribute('aria-pressed','false');
     const input=el('input');input.value=c.text;input.maxLength=24;input.placeholder='写下这一格';input.setAttribute('aria-label','第'+(i+1)+'格内容');
     input.onfocus=()=>{
      if(editing&&editing.index!==i){if(!draft.cells[editing.index].text.trim()){list.querySelectorAll('.ww-row input')[editing.index]?.focus();return;}editing=null;}
      if(!editing)editing={index:i,original:c.text,added:false};drawActions();
     };
     input.oninput=()=>{c.text=input.value;drawActions();};
     input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();finishEdit(true);}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishEdit(false);}};
     const remove=button('×',()=>{if(editing&&!finishEdit(true))return;draft.cells.splice(i,1);drawList();drawActions();},'ww-remove');
     remove.setAttribute('aria-label','删除第'+(i+1)+'格');remove.disabled=draft.cells.length<=3;
     row.append(dot,input,remove);wrap.append(row);list.append(wrap);
    });
    if(draft.cells.length<12)list.append(button('+　加一格（'+draft.cells.length+' / 12）',()=>{
     if(!finishEdit(true))return;root.MamoBarAudio?.play('select');
     const colors=themes[draft.theme].colors,last=draft.cells.at(-1).color,light=colors[0],index=draft.cells.length;
     draft.cells.push({text:'',color:last.toUpperCase()===light.toUpperCase()?colors[1+Math.floor(index/2)%(colors.length-1)]:light});
     editing={index,original:'',added:true};drawList();drawActions();const input=list.querySelectorAll('input')[index];input.focus();input.scrollIntoView({block:'nearest'});
    },'ww-add'));
   }
   function drawThemes(){
    palette.replaceChildren();
    themes.forEach((theme,i)=>{
     const row=el('div','ww-theme'),choose=button('',()=>{
      if(!finishEdit(true))return;root.MamoBarAudio?.play('select');draft.theme=i;draft.cells.forEach((c,j)=>c.color=colorAt(theme,j));drawList();drawThemes();
     },'ww-theme-choice');
     choose.setAttribute('aria-label','应用'+theme.name+'主题');choose.setAttribute('aria-pressed',String(draft.theme===i));
     choose.append(el('span','ww-theme-name',theme.name));
     theme.colors.forEach(color=>{const dot=el('span','ww-swatch');dot.style.background=color;choose.append(dot);});
     row.append(choose);palette.append(row);
    });
   }
   drawList();drawThemes();drawActions();
  }
  return {show,dispose};
 }
 root.MamoBarWheel={create};
})(window);
