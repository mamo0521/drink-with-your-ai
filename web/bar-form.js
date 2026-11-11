/* Form editor for the bar's three Markdown files (menu & rules, tipsy voice, question banks).
   Markdown in, Markdown out: the files keep their format, players just fill in fields.
   Sections the player did not touch are written back byte for byte. */
(function(root){
  'use strict';
  const doc=root.document;
  const ENTRY=/^\*\*([「『"]?)(.+?)[」』"]?(?:\s*·\s*(?:(?:醉意\s*)?([+\-−]?\s*[0-9.]+)\s*(?:杯)?|(无酒精)))?\*\*[ \t]*([^\s*]*)\s*$/;
  const CLOSE={'「':'」','『':'』','"':'"'};
  const TEA=/茶水|无酒精|不入醉/;
  const RULE=/^\s*-{3,}\s*$/;
  const heads=raw=>String(raw||'').split(/^(##[ \t]*[^\r\n]*\r?\n?)/m);
  const title=h=>h.replace(/^##\s*/,'').trim();

  // ---- menu & rules ----
  function parseMenu(raw){
    const parts=heads(raw),sections=[];
    for(let i=1;i<parts.length;i+=2){
      const name=title(parts[i]),body=parts[i+1]||'',tea=TEA.test(name);
      const lines=body.split(/\r?\n/);
      while(lines.length&&(!lines[lines.length-1].trim()||RULE.test(lines[lines.length-1])))lines.pop();
      const drinks=[],lead=[];let cur=null;
      for(const line of lines){
        const m=ENTRY.exec(line.trim());
        let value=null;
        if(m){
          if(m[3]){const n=parseFloat(m[3].replace(/\s+/g,'').replace('−','-'));if(!isNaN(n))value=n;}
          else if(m[4])value=0;
          else if(tea&&!/[·杯]/.test(m[2]))value=0;
        }
        if(value!==null){
          cur={wrap:m[1],name:m[2].trim(),emoji:m[5]||'',en:'',desc:[],mode:value>0?'alc':value<0?'sober':'none',value:Math.abs(value)||1,first:true};
          drinks.push(cur);
        }else if(cur){
          const en=cur.first&&/^\s*英文名[：:][ \t]*(.*)$/.exec(line);
          if(en)cur.en=en[1].trim();else cur.desc.push(line);
          cur.first=false;
        }else lead.push(line);
      }
      drinks.forEach(d=>{d.desc=d.desc.join('\n').trim();delete d.first;});
      const text=lines.join('\n').trim();
      const kind=drinks.length||(!text&&!/规矩/.test(name))?'drinks':'text';
      sections.push({raw:parts[i]+body,dirty:false,kind,name,lead:lead.join('\n').trim(),drinks,text});
    }
    return {pre:parts[0],sections};
  }
  const num=(d)=>d.mode==='sober'&&Number.isInteger(d.value)?String(d.value):d.value.toFixed(1);
  function drinkMd(d,tea){
    const name=(d.wrap||'')+d.name.trim()+(d.wrap?CLOSE[d.wrap]:'');
    const tail=d.mode==='alc'?' · 醉意 +'+num(d):d.mode==='sober'?' · 醉意 -'+num(d):tea?'':' · 无酒精';
    return ['**'+name+tail+'**'+(d.emoji.trim()?' '+d.emoji.trim():''),d.en.trim()?'英文名：'+d.en.trim():'',d.desc.trim()].filter(Boolean).join('\n');
  }
  function sectionMd(s,last){
    const head='## '+(s.name.trim()||'未命名')+'\n\n';
    if(s.kind==='text')return head+s.text.trim()+'\n'+(last?'':'\n---\n\n');
    const tea=TEA.test(s.name);
    const body=[s.lead,...s.drinks.filter(d=>d.name.trim()).map(d=>drinkMd(d,tea))].filter(Boolean).join('\n\n');
    return head+(body?body+'\n\n':'')+(last?'':'---\n\n');
  }
  function serializeMenu(model){
    const n=model.sections.length;
    return model.pre+model.sections.map((s,i)=>{
      let piece=s.dirty||!s.raw?sectionMd(s,i===n-1):s.raw;
      if(i<n-1&&!/\n[ \t]*\r?\n$/.test(piece))piece=piece.replace(/\s*$/,'')+'\n\n';
      return piece;
    }).join('');
  }

  // ---- tipsy voice ----
  function parseTiers(raw){
    const m=/^(---\r?\n[\s\S]*?\r?\n---\r?\n)?([\s\S]*)$/.exec(String(raw||''));
    const front=m[1]||'',parts=heads(m[2]),at={};
    const line=/^tiers:\s*(.+)$/m.exec(front);
    if(line)for(const pair of line[1].trim().split(/\s+/)){const [k,v]=pair.split('=');if(k&&v)at[k]=v;}
    const tiers=[];
    for(let i=1;i<parts.length;i+=2)tiers.push({name:title(parts[i]),text:(parts[i+1]||'').trim(),at:at[title(parts[i])]||''});
    return {front,pre:parts[0],tiers};
  }
  const serializeTiers=m=>m.front+m.pre+m.tiers.map(t=>'## '+t.name+'\n\n'+t.text.trim()+'\n').join('\n');

  // ---- question banks ----
  function parseBanks(raw){
    const pre=[],banks=[];let bank=null,group=null;
    for(const line of String(raw||'').split(/\r?\n/)){
      let m;
      if((m=/^#\s+(.+?)\s*$/.exec(line))){bank={title:m[1],notes:[],groups:[]};banks.push(bank);group=null;}
      else if(!bank){pre.push(line);}
      else if((m=/^##\s+(.+?)\s*$/.exec(line))){group={tag:m[1],notes:[],items:[]};bank.groups.push(group);}
      else if((m=/^\s*(?:[-*]|\d+[.、])\s+(.+?)\s*$/.exec(line))&&!RULE.test(line)){
        if(!group){group={tag:'',notes:[],items:[]};bank.groups.push(group);}
        group.items.push(m[1]);
      }else if(line.trim()&&!RULE.test(line))(group||bank).notes.push(line.trim());
    }
    return {pre:pre.join('\n').replace(/\s*$/,''),banks};
  }
  function serializeBanks(m){
    const one=s=>s.trim().replace(/\s*\n\s*/g,' ');
    const body=m.banks.map(b=>'# '+b.title+'\n'+b.notes.map(n=>n+'\n').join('')+b.groups.map(g=>
      (g.tag?'## '+g.tag+'\n':'')+g.notes.map(n=>n+'\n').join('')+g.items.filter(t=>t.trim()).map(t=>'- '+one(t)+'\n').join('')
    ).join('\n')).join('\n------------------------------------------\n\n');
    return (m.pre?m.pre+'\n\n':'')+body;
  }

  // ---- UI ----
  const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const btn=(cls,text,fn)=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
  function area(value,label,onInput){
    const ta=el('textarea','bform-area');ta.value=value;ta.rows=1;ta.setAttribute('aria-label',label);ta.spellcheck=false;
    const fit=()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+2+'px';};
    ta.oninput=()=>{fit();onInput(ta.value);};root.requestAnimationFrame(fit);return ta;
  }
  function field(label,value,onInput,opts={}){
    const l=el('label','bform-field'+(opts.cls?' '+opts.cls:''));l.append(el('span','',label));
    const input=el('input');input.value=value;input.autocomplete='off';input.spellcheck=false;if(opts.placeholder)input.placeholder=opts.placeholder;
    input.oninput=()=>onInput(input.value);l.append(input);return l;
  }
  // 列表重画时滚动位置会被清掉。keep(box, 重画, 锚点)：重画前记下位置，重画后放回去；
  // 给了锚点（返回要盯住的那个元素的函数）就让它在屏幕上的位置纹丝不动——点开卡片时用。
  function scrollerOf(node){for(let n=node;n&&n!==doc.body;n=n.parentElement){const o=root.getComputedStyle(n).overflowY;if((o==='auto'||o==='scroll')&&n.scrollHeight>n.clientHeight)return n;}return null;}
  function keep(box,redraw,anchor){
    const sc=scrollerOf(box),top=sc?sc.scrollTop:0,before=anchor&&anchor()?.getBoundingClientRect().top;
    redraw();
    const now=scrollerOf(box)||sc;if(!now)return;
    now.scrollTop=top;
    const after=anchor&&anchor()?.getBoundingClientRect().top;
    if(before!=null&&after!=null)now.scrollTop+=after-before;
  }
  const badge=d=>d.mode==='alc'?'+'+num(d):d.mode==='sober'?'−'+num(d):'无酒精';

  // 一张酒图：必须是 180×220 的 PNG。不合格回一句给玩家看的话，合格回空串。
  const PIC_W=180,PIC_H=220,PIC_MAX=200000;
  function checkPicture(file){
    return new Promise(done=>{
      if(file.type!=='image/png')return done('要 PNG 图片（透明底）。');
      if(file.size>PIC_MAX)return done('图片太大了（'+Math.round(file.size/1000)+' KB），请压到 '+PIC_MAX/1000+' KB 以内。');
      const url=URL.createObjectURL(file),probe=new Image();
      probe.onload=()=>{URL.revokeObjectURL(url);done(probe.naturalWidth===PIC_W&&probe.naturalHeight===PIC_H?'':'图片要 '+PIC_W+'×'+PIC_H+'，这张是 '+probe.naturalWidth+'×'+probe.naturalHeight+'。');};
      probe.onerror=()=>{URL.revokeObjectURL(url);done('这张图打不开，换一张试试。');};
      probe.src=url;
    });
  }
  // 酒卡里的配图一栏。images = {url, custom, upload, remove}，由外面（bar-ui.js）接到各家后端。
  function pictureRow(d,images,redraw){
    const name=()=>d.name.trim(),row=el('div','bform-pic'),thumb=el('img'),side=el('div','bform-pic-side'),tip=el('p','bform-tip');
    thumb.alt='';thumb.width=54;thumb.height=66;thumb.src=images.url(d.pic||name()||'新的一杯');thumb.onerror=()=>{thumb.onerror=null;thumb.src='/assets/bar/default.svg';};
    const say=(text,bad)=>{tip.textContent=text;tip.classList.toggle('is-bad',!!bad);};
    const idle=()=>say(name()?PIC_W+'×'+PIC_H+' 的透明底 PNG。':'先填酒名，再配图。');
    const input=el('input');input.type='file';input.accept='image/png';input.hidden=true;
    const pick=btn('bform-link','换图片',()=>{if(!name())return idle();input.click();});
    const actions=el('div','bform-pic-actions');actions.append(pick);
    if(d.pic&&images.custom(d.pic))actions.append(btn('bform-link','用回原图',async()=>{say('正在换回…');try{await images.remove(d.pic);redraw();}catch(e){say(e.message,true);}}));
    input.onchange=async()=>{
      const file=input.files[0];input.value='';if(!file||!name())return;
      const problem=await checkPicture(file);if(problem)return say(problem,true);
      say('正在上传…');
      try{await images.upload(name(),file);d.pic=name();redraw();}catch(e){say(e.message,true);}
    };
    side.append(actions,tip,input);row.append(thumb,side);idle();row.refresh=idle;
    return row;
  }

  function mountMenu(box,text,emit,state={}){
    const model=parseMenu(text);let open=null;
    // 图是按酒名存的。改了酒名 / 删了酒，等按下保存时再让图跟着改名 / 删掉（没保存就什么都不动）。
    // moved = {现在的酒名: 图存在哪个名字下}，gone = 被删掉的酒的图；都记在 state 上，切页签回来还在。
    const moved=state.moved||={},gone=state.gone||=[];
    const all=()=>model.sections.flatMap(s=>s.drinks);
    all().forEach(d=>{d.pic=moved[d.name]||d.name;});
    const rename=(d,v)=>{delete moved[d.name];d.name=v;if(v.trim()&&d.pic&&d.pic!==v.trim())moved[v.trim()]=d.pic;};
    state.afterSave=async()=>{
      const images=state.images;if(!images)return;
      for(const [to,from] of Object.entries(moved)){delete moved[to];if(images.custom(from)&&!images.custom(to))await images.rename(from,to);}
      const names=new Set(all().map(d=>d.name.trim()));
      for(const name of gone.splice(0))if(!names.has(name)&&images.custom(name))await images.remove(name);
      all().forEach(d=>{d.pic=d.name.trim();});
    };
    const changed=s=>{if(s)s.dirty=true;emit(serializeMenu(model));};
    const rowOf=d=>[...box.querySelectorAll('.bform-drink')].find(c=>c.drink===d)?.firstChild;
    function draw(focus,anchor){
      keep(box,()=>paint(),anchor);
      if(focus){const card=box.querySelector('.bform-drink.is-open');card?.querySelector('.bform-field input')?.focus({preventScroll:true});card?.scrollIntoView({block:'nearest'});}
    }
    function paint(){
      box.replaceChildren();
      model.sections.forEach((s,si)=>{
        const sec=el('section','bform-section');
        if(s.kind==='text'){
          sec.append(el('h3','bform-heading',s.name));
          sec.append(area(s.text,s.name,v=>{s.text=v;changed(s);}));
          box.append(sec);return;
        }
        const head=el('div','bform-cat');
        const name=el('input','bform-cat-name');name.value=s.name;name.setAttribute('aria-label','分类名');name.placeholder='分类名';name.autocomplete='off';
        name.oninput=()=>{s.name=name.value;changed(s);};head.append(name);
        if(!s.drinks.length)head.append(btn('bform-link','删掉分类',()=>{model.sections.splice(si,1);const prev=model.sections[si-1];if(prev)prev.dirty=true;changed();draw();}));
        sec.append(head);
        if(s.lead)sec.append(el('p','bform-note',s.lead.replace(/^>\s?/gm,'').replace(/\*\*/g,'')));
        s.drinks.forEach((d,di)=>{
          const card=el('div','bform-drink'+(open===d?' is-open':''));card.drink=d;
          const row=btn('bform-row','',()=>{open=open===d?null:d;draw(false,()=>rowOf(d));});row.setAttribute('aria-expanded',String(open===d));
          row.append(el('span','bform-name',d.name||'新的一杯'),el('em','',d.en),el('span','bform-badge is-'+d.mode,badge(d)));
          card.append(row);
          if(open===d){
            const form=el('div','bform-body');
            const refresh=()=>{row.children[0].textContent=d.name||'新的一杯';row.children[1].textContent=d.en;row.children[2].textContent=badge(d);row.children[2].className='bform-badge is-'+d.mode;};
            // 酒名后面的小图标（emoji）界面上用不到，不给格子；文件里原有的照旧留着。
            const pic=state.images?pictureRow(d,state.images,()=>draw()):null;if(pic)form.append(pic);
            form.append(field('酒名',d.name,v=>{rename(d,v);refresh();pic?.refresh();changed(s);},{placeholder:'比如：热红酒'}),field('英文名（可以不填）',d.en,v=>{d.en=v;refresh();changed(s);},{placeholder:'Mulled Wine'}));
            const power=el('div','bform-power');power.append(el('span','bform-label','醉意'));
            const seg=el('div','bform-seg');
            for(const [mode,label] of [['alc','含酒精'],['none','无酒精'],['sober','醒酒']]){
              const b=btn(d.mode===mode?'is-on':'',label,()=>{if(d.mode===mode)return;d.mode=mode;d.value=mode==='sober'?3:1;changed(s);draw();});b.setAttribute('aria-pressed',String(d.mode===mode));seg.append(b);
            }
            power.append(seg);
            if(d.mode!=='none'){
              const step=d.mode==='alc'?.1:.5,max=d.mode==='alc'?5:10,stepper=el('div','bform-stepper');
              const out=el('output','',(d.mode==='alc'?'+':'−')+num(d));
              const bump=k=>{d.value=Math.min(max,Math.max(step,Math.round((d.value+k*step)*10)/10));out.textContent=(d.mode==='alc'?'+':'−')+num(d);refresh();changed(s);};
              const minus=btn('','−',()=>bump(-1)),plus=btn('','+',()=>bump(1));minus.setAttribute('aria-label','减一点');plus.setAttribute('aria-label','加一点');
              stepper.append(minus,out,plus);power.append(stepper);
              power.append(el('p','bform-tip',d.mode==='alc'?'喝下这杯，醉意加这么多。威士忌是 +1.0。':'吃下去，醉意立刻退这么多。'));
            }
            form.append(power);
            const about=el('label','bform-field');about.append(el('span','','这杯的讲究'),area(d.desc,'这杯的讲究',v=>{d.desc=v;changed(s);}));form.append(about);
            const foot=el('div','bform-foot');
            const up=btn('bform-move','↑',()=>{s.drinks.splice(di-1,0,s.drinks.splice(di,1)[0]);changed(s);draw(false,()=>rowOf(d));}),down=btn('bform-move','↓',()=>{s.drinks.splice(di+1,0,s.drinks.splice(di,1)[0]);changed(s);draw(false,()=>rowOf(d));});
            up.disabled=di===0;down.disabled=di===s.drinks.length-1;up.setAttribute('aria-label','上移');down.setAttribute('aria-label','下移');
            foot.append(el('span','bform-label','调整顺序'),up,down,btn('bform-link is-danger','删掉这杯',()=>{if((d.name||d.desc)&&!root.confirm('删掉「'+(d.name||'这杯')+'」？'))return;delete moved[d.name];if(d.pic)gone.push(d.pic);s.drinks.splice(di,1);open=null;changed(s);draw();}));
            form.append(foot);card.append(form);
          }
          sec.append(card);
        });
        sec.append(btn('bform-add','＋ 加一杯',()=>{const d={wrap:'',name:'',emoji:'',en:'',desc:'',mode:TEA.test(s.name)?'none':'alc',value:1};s.drinks.push(d);open=d;changed(s);draw(true);}));
        box.append(sec);
      });
      const addCat=btn('bform-add is-cat','＋ 加一个分类',()=>{
        let at=model.sections.length;while(at>0&&model.sections[at-1].kind==='text')at--;
        const s={raw:'',dirty:true,kind:'drinks',name:'',lead:'',drinks:[],text:''};
        model.sections.splice(at,0,s);if(model.sections[at-1])model.sections[at-1].dirty=true;changed(s);draw();
        box.querySelectorAll('.bform-cat-name')[model.sections.filter((x,i)=>i<at&&x.kind==='drinks').length]?.focus();
      });
      const firstText=[...box.children].find((n,i)=>model.sections[i]?.kind==='text');
      if(firstText)box.insertBefore(addCat,firstText);else box.append(addCat);
    }
    draw();
  }

  function mountTiers(box,text,emit){
    const model=parseTiers(text);
    for(const t of model.tiers){
      const sec=el('section','bform-section');
      const h=el('h3','bform-heading',t.name);if(t.at)h.append(el('em','','醉意到 '+t.at));
      sec.append(h,area(t.text,t.name+'时的样子',v=>{t.text=v;emit(serializeTiers(model));}));box.append(sec);
    }
    if(!model.tiers.length)box.append(el('p','bform-empty','这份文件里没有找到档位，点右上角「看原文」检查一下。'));
  }

  function mountBanks(box,text,emit,state){
    const model=parseBanks(text);const changed=()=>emit(serializeBanks(model));
    const short=t=>t.replace(/[·・]?\s*题库\s*$/,'');
    let fresh=null;
    function draw(focusGroup){fresh=null;keep(box,()=>paint(focusGroup));if(fresh){fresh.focus({preventScroll:true});fresh.scrollIntoView({block:'nearest'});}}
    function paint(focusGroup){
      box.replaceChildren();
      if(!model.banks.length){box.append(el('p','bform-empty','这份文件里没有找到题库，点右上角「看原文」检查一下。'));return;}
      state.bank=Math.min(state.bank||0,model.banks.length-1);
      const seg=el('div','bform-seg is-banks');
      model.banks.forEach((b,i)=>{const t=btn(i===state.bank?'is-on':'',short(b.title),()=>{state.bank=i;draw();});t.setAttribute('aria-pressed',String(i===state.bank));seg.append(t);});
      box.append(seg);
      const bank=model.banks[state.bank];
      bank.notes.forEach(n=>box.append(el('p','bform-note',n.replace(/\*\*/g,''))));
      bank.groups.forEach(g=>{
        const sec=el('section','bform-section');
        const h=el('h3','bform-heading',g.tag||'题目');h.append(el('em','',g.items.length+' 条'));sec.append(h);
        g.notes.forEach(n=>sec.append(el('p','bform-note',n.replace(/\*\*/g,''))));
        g.items.forEach((item,i)=>{
          const row=el('div','bform-item');
          const del=btn('bform-x','×',()=>{g.items.splice(i,1);changed();draw();});del.setAttribute('aria-label','删掉这一条');
          row.append(area(item,'题目',v=>{g.items[i]=v;changed();}),del);sec.append(row);
        });
        sec.append(btn('bform-add','＋ 加一条',()=>{g.items.push('');draw(g);}));
        box.append(sec);
        if(focusGroup===g){const all=sec.querySelectorAll('textarea');fresh=all[all.length-1]||null;}
      });
    }
    draw();
  }

  // kind: 'bar' | 'alcohol' | 'questions'. `state` survives re-mounts of the same editor session.
  function mount(kind,container,text,onChange,state={}){
    container.classList.add('bar-form');
    ({bar:mountMenu,alcohol:mountTiers,questions:mountBanks})[kind](container,text,onChange,state);
  }
  root.MamoBarForm={mount,parseMenu,serializeMenu,parseTiers,serializeTiers,parseBanks,serializeBanks};
})(typeof window!=='undefined'?window:globalThis);
