/* Full-screen bar UI. Reads live standard-cup values; confirming only locks a
 * drink in the composer. No alcohol/state/chat writes are made by this view. */
(function(root){
  'use strict';
  root.document?.addEventListener('dblclick',e=>{const target=e.target;if(!target?.closest?.('.bar-screen,.bf-panel,.bar-strip,.bar-standalone'))return;if(target.closest('input,textarea,[contenteditable]:not([contenteditable="false"])'))return;e.preventDefault();});
  const META=/^<!-- bar-ui: (.*?) -->\r?\n?/m;
  const cleanTitle=s=>String(s||'').replace(/[（(][^（）()]*[）)]/g,'').trim();
  const cjk=s=>/[\u3400-\u9fff]/.test(s);
  const FIELDS={alcohol:'alcohol',questions:'questions'};
  // 她的题库缺哪一段（真心话 / 大冒险 / 盲品），就把出厂那一段接在后面给她看、让她改（保存前只是草稿）。
  function missingBanks(mine,factory){
    const sections=String(factory).split(/^(?=# )/m).filter(s=>s.startsWith('# '));
    const have=String(mine);
    return sections.filter(sec=>{const name=sec.match(/^# (.+)/)[1].replace(/·题库$/,'');return !new RegExp('^# .*'+name,'m').test(have);}).map(s=>s.trim()+'\n').join('\n');
  }
  // 和酒单正文同一个口吻：「我」是吧台里的 Ta，「他」是来喝酒的人。
  const FLIGHT_DESC='六个一模一样的杯子：三杯白水，两杯酒单上的酒，一杯最烈的。\n一人一杯轮流揭。我揭到酒，整杯喝掉；你揭到酒，换一张同样分量的整蛊纸条，当场兑现。\n纸条上的题在 edit 的「题库」里改，「亲密」题开关在下方。';
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readMeta(raw){
    const m=String(raw||'').match(META);
    if(!m)return {};
    try{const v=JSON.parse(m[1]);return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch(e){return {};}
  }
  function withMeta(raw,meta){
    // Presentation-only fields live beside the canonical menu, before ##.
    // Existing server menu/std parsing is unchanged. Escape comment terminators.
    const {drinkNames,...sign}=meta;
    const json=JSON.stringify(sign).replace(/</g,'\\u003c').replace(/>/g,'\\u003e');
    return '<!-- bar-ui: '+json+' -->\n'+String(raw).replace(META,'');
  }
  function groupEnglish(title){
    const t=cleanTitle(title);
    if(/今晚/.test(t))return 'Tonight’s specials';
    if(/今日/.test(t))return "Today’s special";
    if(/常备/.test(t))return 'House classics';
    if(/特调/.test(t))return 'House creations';
    if(/茶|无酒精/.test(t))return 'Tea & soft drinks';
    if(/私藏/.test(t))return 'Owner’s reserve';
    return '';
  }
  function nameEnglish(item){
    if(item.flight)return 'Blind flight';
    if(item.special)return "Today’s special";
    return typeof item.name_en==='string'?item.name_en.trim():'';
  }
  function menuTextFields(raw){
    const result=new Map();
    // Only recover the full description for items already supplied by /activities.
    // Never derive or override standard-cup values from the UI/placeholder data.
    for(const section of String(raw||'').split(/^##\s+.+$/m).slice(1)){
      const re=/^\*\*[「『"]?(.+?)[」』"]?(?:\s*·\s*(?:醉意\s*\+?\s*)?[0-9.]+\s*(?:杯)?)?\*\*[^\n]*\n/gm;
      const matches=[...section.matchAll(re)];
      matches.forEach((m,i)=>{
        let desc=section.slice(m.index+m[0].length,matches[i+1]?.index??section.length);
        const english=desc.match(/^\s*英文名[：:][ \t]*([^\r\n]*)(?:\r?\n|$)/);
        if(english)desc=desc.slice(english[0].length);
        desc=desc.replace(/\n\s*---\s*$/,'').replace(/[*_`#]/g,'').trim();
        result.set(m[1],{name_en:english?english[1].trim():'',desc});
      });
    }
    return result;
  }
  function descriptions(raw){return new Map([...menuTextFields(raw)].map(([name,fields])=>[name,fields.desc]));}
  function withMenuText(menu,raw){const fields=menuTextFields(raw);return menu.map(i=>({...i,name_en:i.name_en??fields.get(i.name)?.name_en??'',desc:fields.get(i.name)?.desc||i.desc}));}
  function highlight(raw){
    return String(raw).split('\n').map(line=>{
      if(/^\s*<!--/.test(line))return '<span class="md-comment">'+escape(line)+'</span>';
      if(/^#{1,6}\s/.test(line))return '<span class="md-heading">'+escape(line)+'</span>';
      if(/^\s*-{3,}\s*$/.test(line))return '<span class="md-rule">'+escape(line)+'</span>';
      // 我们写给玩家看的说明：`> ` 开头的行，或整行加粗的一句话（酒名条目带「·」或很短，不算）。橘色，和玩家自己写的字分开。
      if(/^\s*>/.test(line)||(/^\*\*[^*·]{12,}\*\*\s*$/.test(line)))return '<span class="md-note">'+escape(line)+'</span>';
      return line.split(/(\*\*[^*]+\*\*)/g).map(part=>/^\*\*/.test(part)?'<span class="md-strong">'+escape(part)+'</span>':escape(part)).join('');
    }).join('\n')+'\n';
  }
  function create(options){
    const doc=root.document;
    const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
    const button=(cls,text,fn)=>{const n=el('button',cls,text);n.type='button';n.onclick=e=>{if(fn){root.MamoBarAudio?.buttonCue(n,text);return fn.call(n,e);}};return n;};
    const icon=name=>{const i=el('img');i.src='/assets/bar/ui/'+name+'.svg';i.alt='';return i;};
    const screen=el('section','bar-screen');screen.hidden=true;screen.setAttribute('role','dialog');screen.setAttribute('aria-modal','true');screen.setAttribute('aria-label','吧台酒单');screen.tabIndex=-1;doc.body.append(screen);
    let def={},meta={},rawBar='',items=[],selection=null,lastFocus=null,layout=null,scroll=null,menuScroll=0;
    let openVersion=0,editorTab='bar',drafts={},base={},editorBusy=false,editorDirty=false;
    let editorStatus=null,editorButtons=[],editorLoaded=new Set(),editorVersion=0;
    let inertRestore=[];
    async function json(url,init){const r=await (options.fetch||root.fetch)(url,init);const data=await r.json();if(!r.ok||data.ok===false)throw new Error(data.error||'读取失败，请重试');return data;}
    function activate(){
      if(screen.hidden){lastFocus=doc.activeElement;inertRestore=[...doc.body.children].filter(n=>n!==screen&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE').map(n=>[n,n.inert]);inertRestore.forEach(([n])=>n.inert=true);}
      screen.hidden=false;root.MamoBarMusic?.sync();screen.focus({preventScroll:true});
    }
    function hide(){openVersion++;editorVersion++;screen.hidden=true;root.MamoBarMusic?.sync();screen.replaceChildren();inertRestore.forEach(([n,v])=>n.inert=v);inertRestore=[];lastFocus?.focus?.({preventScroll:true});}
    function leave(){if(editorDirty&&!root.confirm('放弃尚未保存的修改，返回酒单？'))return;editorDirty=false;hide();options.onClose?.();}
    function titleNodes(title,subtitle,parent){
      const t=el('h1','bar-title'+(cjk(title)?' has-cjk':''),title);
      const s=el('p','bar-subtitle'+(cjk(subtitle)?' has-cjk':''),subtitle);parent.append(t,s);
    }
    function shell(editor=false){
      screen.classList.toggle('bar-editor',editor);screen.replaceChildren();layout=el('div','bar-layout');
      layout.append(el('div','bar-frame'));const header=el('header','bar-header');
      const back=button('bar-back','',()=>editor?exitEditor():leave());back.setAttribute('aria-label',editor?'返回酒单':'返回首页');back.append(icon('back-arrow'));header.append(back);
      if(editor)titleNodes('EDIT MENU','编辑酒单',header);
      else{
        const star=el('div','bar-star');
        for(const [name,cls] of [['star-base','bar-star-base'],['star-lines','bar-star-lines'],['star-ne','bar-star-ray bar-star-ne'],['star-se','bar-star-ray bar-star-se'],['star-nw','bar-star-ray bar-star-nw'],['star-sw','bar-star-ray bar-star-sw']]){const i=icon(name);i.className=cls;star.append(i);}
        const leftStar=el('span','bar-header-corner left');leftStar.append(icon('header-corners'));
        const rightStar=el('span','bar-header-corner right');rightStar.append(icon('header-corners'));
        header.append(star,leftStar,rightStar);if(root.MamoBarMusic)header.append(root.MamoBarMusic.button());
        titleNodes(meta.title||"AMBER",meta.subtitle??'AFTERHOURS',header);
        const guide=button('bar-edit-link bar-guide-link','',()=>openGuide());guide.append(icon('guide'),el('span','','guide'));guide.setAttribute('aria-label','吧台玩法说明');header.append(guide);
      }
      layout.append(header);screen.append(layout);return layout;
    }
    function drinkImage(item){const image=el('img');image.alt=item.name;image.loading='lazy';image.src='/assets/bar/'+encodeURIComponent((item.special?'今日特调':item.flight?'盲品':item.name).replace(/[:/\\?*"<>|]/g,'-'))+'.png';image.onerror=()=>{image.onerror=null;image.src='/assets/bar/default.svg';};return image;}
    function textInfo(item,parent){
      parent.append(el('span','bar-drink-name',item.name));const en=nameEnglish(item,meta);if(en)parent.append(el('span','bar-drink-en',en));
      parent.append(el('span','bar-drink-std'+(item.flight?' bar-flight-summary':''),item.flight?'六杯盲喝，\n边喝边玩':+item.std>0?'✦ + '+Number(item.std).toFixed(1):'无酒精'));
    }
    function detail(item,onClose){
      const card=el('article','bar-detail');card.setAttribute('aria-label',item.name+'详情');
      const picture=el('div','bar-detail-photo');picture.append(drinkImage(item));
      const copy=el('div','bar-detail-copy');textInfo(item,copy);copy.append(el('p','bar-description',item.desc||'这一杯还没有注脚。'));
      const actions=el('div','bar-detail-actions');
      if(item.flight&&root.MamoBarBank){   // 亲密池开关（和赌桌真心话同一个）
        copy.append(root.MamoBarBank.createSwitch());
      }
      const confirm=button('bar-pill primary','确定',async()=>{
        if(!item.flight){const cue=root.MamoBarAudio?.confirmCue(item);if(cue)root.MamoBarAudio.play(cue);hide();options.onConfirm(item);return;}
        root.MamoBarAudio?.prepare();
        // The server pours the six cups now; the picker opens from the chat strip.
        confirm.disabled=true;const note=copy.querySelector('.bar-description');
        try{await options.onFlight?.();root.MamoBarAudio?.play('openPour');note.textContent='酒正在准备，请回座——小纸条上会提示你选杯。';await new Promise(r=>root.setTimeout(r,1100));hide();options.onFlightReady?.();}
        catch(e){note.textContent=e.message;confirm.disabled=false;}
      });
      confirm.dataset.sound='drink';
      actions.append(button('bar-pill','close',onClose),confirm);
      card.append(picture,copy,actions);return card;
    }
    function renderMenu(){
      shell();scroll=el('div','bar-scroll bar-menu-scroll');layout.append(scroll);
      const fade=()=>{scroll.style.setProperty('--menu-fade-top',scroll.scrollTop>1?'18px':'0px');scroll.style.setProperty('--menu-fade-bottom',scroll.scrollTop+scroll.clientHeight<scroll.scrollHeight-1?'18px':'0px');};
      scroll.addEventListener('scroll',fade,{passive:true});requestAnimationFrame(fade);
      const groups=[];for(const item of items){let g=groups.find(g=>g.name===item.group);if(!g){g={name:item.group,items:[]};groups.push(g);}g.items.push(item);}
      // Tonight's specials lead the menu: the blind flight and the random special.
      const tonight=[];
      if(options.onFlight&&groups.some(g=>g.items.some(i=>+i.std>0)))tonight.push({name:'盲品',flight:true,desc:FLIGHT_DESC});
      if(options.makeSpecial&&groups.some(g=>g.items.some(i=>+i.std>0)))tonight.push({name:'今日特调',special:true});
      if(tonight.length)groups.unshift({name:'今晚特别',items:tonight});
      if(!groups.length)scroll.append(el('p','bar-notice','酒单暂时没有内容，请在编辑页添加。'));
      let activeSlot=null,activeButton=null,selectionScroll=0;
      for(const group of groups){
        const section=el('section','bar-section'),heading=el('header','bar-section-heading');
        const line=el('div','bar-heading-line');line.append(icon('flourish'),el('h2','',cleanTitle(group.name)||'酒单'),icon('flourish'));
        heading.append(line,el('em','',groupEnglish(group.name)));section.append(heading);
        for(let i=0;i<group.items.length;i+=2){
          const row=el('div','bar-row'),slot=el('div','bar-detail-slot'),clip=el('div','bar-detail-clip');slot.append(clip);slot.inert=true;
          slot.id='bar-detail-'+groups.indexOf(group)+'-'+i;
          function closeDetail(){slot.classList.remove('is-open');slot.inert=true;activeButton?.setAttribute('aria-expanded','false');activeButton?.focus({preventScroll:true});scroll.scrollTop=selectionScroll;activeSlot=null;activeButton=null;selection=null;}
          for(const item of group.items.slice(i,i+2)){
            const b=button('bar-drink','',()=>{
              if(activeButton===b){root.MamoBarAudio?.play('back');closeDetail();return;}
              root.MamoBarAudio?.play('detail');
              if(activeSlot){activeSlot.classList.remove('is-open');activeSlot.inert=true;activeButton?.setAttribute('aria-expanded','false');}
              selectionScroll=scroll.scrollTop;
              selection=item.special?options.makeSpecial():item;activeSlot=slot;activeButton=b;
              b.setAttribute('aria-expanded','true');clip.replaceChildren(detail(selection,closeDetail));slot.inert=false;
              root.requestAnimationFrame(()=>slot.classList.add('is-open'));
            });b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls',slot.id);
            const picture=el('span','bar-drink-image');picture.append(drinkImage(item));const copy=el('span','bar-drink-copy');
            if(item.special){copy.append(el('span','bar-drink-name','今日特调'),el('span','bar-drink-en',"Today’s special"),el('span','bar-drink-std','随机配方'));}else textInfo(item,copy);
            b.append(picture,copy);row.append(b);
          }
          section.append(row,slot);
        }
        scroll.append(section);
      }
      const nav=el('nav','bar-nav');nav.setAttribute('aria-label','吧台');
      const ornament=el('span','bar-footer-ornament');ornament.setAttribute('aria-hidden','true');ornament.append(icon('footer-star'));nav.append(ornament);
      const choices=el('div','bar-ta-choices');choices.hidden=true;choices.setAttribute('role','group');choices.setAttribute('aria-label','让 Ta 选择');
      const choose=button('','Ta来选',()=>{choices.hidden=!choices.hidden;root.MamoBarAudio?.play(choices.hidden?'back':'taMenu');choose.setAttribute('aria-expanded',String(!choices.hidden));});choose.setAttribute('aria-expanded','false');
      const dismiss=()=>{choices.hidden=true;choose.setAttribute('aria-expanded','false');};
      choices.append(button('','让 Ta 看酒单',()=>{dismiss();hide();options.onHandMenu?.();}),button('','让 Ta 自选游戏',()=>{dismiss();hide();options.onInviteGame?.();}));
      layout.addEventListener('pointerdown',e=>{if(!choices.contains(e.target)&&!choose.contains(e.target))dismiss();});
      choices.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();choose.focus();}});
      const edit=button('bar-edit-link bar-nav-edit','',()=>openEditor());edit.append(icon('edit'),el('span','','edit'));edit.setAttribute('aria-label','编辑酒单');
      nav.append(choose,button('is-active','✦ 点酒',()=>scroll.scrollTo({top:0,behavior:'smooth'})),button('','游戏',()=>{hide();options.onGames?.();}),edit,choices);layout.append(nav);scroll.scrollTop=menuScroll;
    }
    function openGuide(){
      menuScroll=scroll?.scrollTop||0;shell(true);
      layout.querySelector('.bar-title').textContent='BAR GUIDE';layout.querySelector('.bar-subtitle').textContent='吧台指南';
      const body=el('div','bar-scroll bar-guide');
      for(const [heading,text] of [
        ['「✦ + 1.2」是什么意思？','✦ 表示醉意。这杯喝下去增加 1.2 醉意；醉意最高为 10，到达上限后不再增加。具体数值以当前酒单为准。无酒精饮品不增加醉意。'],
        ['怎么点酒？','点一款酒，就能展开介绍；再点一次或点 close 收起。选好后点「确定」，这一杯就放到 Ta 面前，你回到首页。'],
        ['放到 Ta 面前以后呢？','去你们聊天的地方告诉 Ta 一声。Ta 用「看吧台」能看到这一杯，喝不喝由 Ta；喝了才计入醉意，也可以推回这杯酒。'],
        ['首页那条小纸条是什么？','左边是 Ta 现在的醉态，玻璃管显示当前醉意，越满、越红表示醉意越高；Ta 按真人的速度醒酒，大约每小时一杯。盲品进行中时，右边会写轮到谁、还剩几杯，点它就能选杯。'],
        ['盲品是什么？','酒单最上面的「盲品」会端上六个看不出内容的杯子：三杯白水、两杯普通酒、一杯最烈的。点确定后回到首页，从小纸条进去选杯，你先选，之后和 Ta 轮流。Ta 揭到酒就整杯记醉意；你揭到酒，会翻出一张任务纸条，记进首页「今晚的记录」，Ta 一看吧台就知道，当场兑现。'],
        ['想和 Ta 玩一局？','点底栏「游戏」，约好赌注，掷骰或猜拳。详细玩法在游戏页的 guide 里。'],
        ['想改一改酒单？','点 edit 可以修改招牌、酒单与规矩、醉态口吻和题库（真心话 / 大冒险 / 盲品）。酒的英文名可填可不填；新加的酒没有图片时，会先显示占位图。']
      ]){const section=el('section');section.append(el('h2','',heading),el('p','',text));body.append(section);}
      layout.append(body);layout.querySelector('.bar-back').focus({preventScroll:true});
    }
    async function open(nextDef){
      def=nextDef||{};editorDirty=false;menuScroll=0;activate();shell();const waiting=el('div','bar-scroll');waiting.append(el('p','bar-notice','正在取酒单…'));layout.append(waiting);const version=++openVersion;
      try{
        const data=await json('/barfile?which=bar');if(version!==openVersion)return;
        rawBar=data.text||'';meta=readMeta(rawBar);
        items=withMenuText(def.menu||[],rawBar);renderMenu();
      }catch(e){if(version!==openVersion)return;waiting.replaceChildren(el('p','bar-notice',e.message),button('bar-pill','重试',()=>open(def)));}
    }
    function exitEditor(){if(editorBusy)return;if(editorDirty&&!root.confirm('放弃尚未保存的修改，返回酒单？'))return;editorVersion++;editorDirty=false;renderMenu();}
    async function openEditor(){
      menuScroll=scroll?.scrollTop||0;
      drafts={bar:rawBar};base={bar:rawBar};editorLoaded=new Set(['bar']);editorDirty=false;editorTab='bar';await renderEditor();
    }
    function status(text){if(editorStatus)editorStatus.textContent=text;}
    async function renderEditor(){
      const version=++editorVersion;shell(true);editorButtons=[];
      const tabs=el('div','bar-editor-tabs');tabs.setAttribute('role','tablist');
      for(const [key,cn,en] of [['names','吧台名称','bar name'],['bar','酒单与规矩','menu & rules'],['alcohol','醉态口吻','tipsy voice'],['questions','题库','questions']]){
        const b=button('',cn,()=>{if(editorBusy||editorTab===key)return;root.MamoBarAudio?.play('select');editorTab=key;renderEditor();});b.append(el('em','',en));b.setAttribute('role','tab');b.setAttribute('aria-selected',String(editorTab===key));tabs.append(b);editorButtons.push(b);
      }
      layout.append(tabs);const body=el('div','bar-editor-body');const hint=el('p','bar-editor-hint');
      hint.textContent='修改方法详见下，按照格式写';
      body.append(hint);layout.append(body);
      const field=FIELDS[editorTab]||'bar';
      const panel=el('div','bar-editor-panel');
      const instructions={names:'招牌支持中文和英文，上下两行分别填写。',bar:'橘色的字是说明，文档里的说明可以删；其余按原有格式写。',alcohol:'按照原有格式写。',questions:'真心话（你问 Ta 的）、大冒险（你让 Ta 做的）、盲品（盲喝的游戏中 Ta 让你做的，难度分三档——轻 / 中 / 重）各一段。\n按现有格式写。\n每个题库里的「## 亲密」只在开关打开时用。'};
      panel.append(el('p','bar-editor-instructions',instructions[editorTab]));
      const content=el('div','bar-code-editor');panel.append(content);body.append(panel);
      const stat=el('div','bar-editor-status');editorStatus=el('span','','');const count=el('span','','');stat.append(editorStatus,count);body.append(stat);
      const actions=el('div','bar-editor-actions');const cancel=button('bar-pill','cancel',exitEditor),save=button('bar-pill primary','保存',saveEditor);actions.append(cancel,save);layout.append(actions);editorButtons.push(cancel,save);save.disabled=true;
      if(!editorLoaded.has(field)){
        status('载入中…');
        try{const d=await json('/barfile?which='+field);if(version!==editorVersion)return;drafts[field]=base[field]=d.text||'';editorLoaded.add(field);
          if(field==='questions'&&d.factory){const missing=missingBanks(drafts[field],d.factory);if(missing){drafts[field]=drafts[field].replace(/\s*$/,'\n\n')+missing;editorDirty=true;}}}
        catch(e){if(version===editorVersion)status(e.message);return;}
      }
      if(version!==editorVersion)return;save.disabled=false;status(editorDirty?'有未保存的修改':'');
      const updateCount=()=>count.textContent=Array.from(drafts[field]||'').length.toLocaleString()+' 字';updateCount();
      if(editorTab==='names'){
        content.className='bar-name-editor';const current={...readMeta(drafts.bar)};delete current.drinkNames;current.title??=meta.title||"AMBER";current.subtitle??=meta.subtitle??'AFTERHOURS';
        const preview=el('div','bar-name-preview');titleNodes(current.title,current.subtitle,preview);content.append(preview);
        const change=()=>{drafts.bar=withMeta(drafts.bar,current);editorDirty=true;status('有未保存的修改');updateCount();preview.replaceChildren();titleNodes(current.title,current.subtitle,preview);};
        const fieldInput=(label,value,onChange)=>{const l=el('label','',label),input=el('input');input.value=value;input.autocomplete='off';input.oninput=()=>{onChange(input.value);change();};l.append(input);content.append(l);};
        fieldInput('招牌 · 上行',current.title,v=>current.title=v);fieldInput('招牌 · 下行',current.subtitle,v=>current.subtitle=v);
      }else{
        const pre=el('pre'),ta=el('textarea');pre.setAttribute('aria-hidden','true');ta.setAttribute('aria-label',{bar:'酒单与规矩',alcohol:'醉态口吻',questions:'题库'}[editorTab]+' Markdown');ta.spellcheck=false;ta.value=field==='bar'?drafts[field].replace(META,''):drafts[field];pre.innerHTML=highlight(ta.value);
        ta.oninput=()=>{const kept=field==='bar'?readMeta(drafts.bar):{};drafts[field]=Object.keys(kept).length?withMeta(ta.value,kept):ta.value;editorDirty=true;pre.innerHTML=highlight(ta.value);pre.scrollTop=ta.scrollTop;status('有未保存的修改');updateCount();};
        ta.onscroll=()=>{pre.scrollTop=ta.scrollTop;pre.scrollLeft=ta.scrollLeft;};content.append(pre,ta);
      }
    }
    async function saveEditor(){
      if(editorBusy)return;editorBusy=true;editorButtons.forEach(b=>b.disabled=true);status('保存中…');
      try{
        // Save only the active document. Switching tabs preserves other drafts.
        const field=FIELDS[editorTab]||'bar';
        let text=drafts[field];
        if(field==='bar'){const m=readMeta(text);text=withMeta(text,{...m,title:m.title??meta.title??"AMBER",subtitle:m.subtitle??meta.subtitle??'AFTERHOURS'});}
        await json('/barfile/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({which:field,text})});
        drafts[field]=base[field]=text;
        if(field==='bar'){
          rawBar=text;meta=readMeta(text);
          const fresh=await options.onReload();def=fresh||def;items=withMenuText(def.menu||[],text);
        }
        editorDirty=Object.keys(drafts).some(k=>drafts[k]!==base[k]);status('已保存 · '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()));
      }catch(e){status('保存未完成：'+e.message);}
      finally{editorBusy=false;editorButtons.forEach(b=>b.disabled=false);}
    }
    screen.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();if(!editorBusy){root.MamoBarAudio?.play('back');if(screen.classList.contains('bar-editor'))exitEditor();else leave();}}
      if(e.key==='Tab'){
        const focusable=[...screen.querySelectorAll('button:not(:disabled),input,textarea')].filter(n=>!n.closest('[inert]'));
        const first=focusable[0],last=focusable.at(-1);if(!first)return;
        if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===screen)){e.preventDefault();last.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    return {open,hide,isOpen:()=>!screen.hidden};
  }
  const api={create,readMeta,withMeta,groupEnglish,nameEnglish,menuTextFields,descriptions,highlight,missingBanks};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MamoBarUI=api;
})(typeof window!=='undefined'?window:globalThis);
