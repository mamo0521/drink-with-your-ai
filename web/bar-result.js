/* Result attachments use readable message text, so existing history keeps them intact. */
(function(root){
 'use strict';
 const START='【吧台游戏结果】',END='【结果结束】';
 // 写进消息和卡片里的玩家称呼：网关 /activities 下发（config.activities.bar.player_name），默认 mamo。
 let PLAYER='对方';const NAME='([^\\s：]{1,24})';
 function setPlayer(name){PLAYER=String(name||'').trim()||'对方';return PLAYER;}
 const clean=v=>String(v||'').replaceAll(START,'').replaceAll(END,'').trim();
 function describe(p){
  if(p.kind==='wheel')return {title:[p.wheel,p.presetName].filter(Boolean).join(' · '),lines:['轮盘结果：'+clean(p.result)]};
  const w=p.wager||{},names={drink:'喝一杯',truth:'真心话',dare:'大冒险',custom:'自定义'};
  const lines=[`Ta ${p.ta} ${p.kind==='dice'?'点':'胜'} · ${PLAYER} ${p.me} ${p.kind==='dice'?'点':'胜'}`];
  if(p.mode===3)lines.push(p.kind==='dice'?'三掷累计':'三局两胜');
  if(w.type==='drink')lines.push('赌注：'+clean(w.drink?.name)+' · '+Number(w.drink?.std||0).toFixed(1)+' 标准杯');
  else if(w.type==='custom')lines.push('赌注：'+clean(w.custom));
  else lines.push(p.question?('题目：'+clean(p.question)):'由 Ta 出题，'+PLAYER+' '+(w.type==='truth'?'回答':'执行'));
  return {title:(names[w.type]||'赌桌')+' · '+(p.winner==='me'?PLAYER+' 赢了':'Ta 赢了')+' · '+(p.kind==='dice'?'骰子':'猜拳'),lines};
 }
 function encode(p,note=''){
  const d=describe(p);
  return START+'\n'+d.title+'\n'+d.lines.join('\n')+'\n局号：'+clean(p.id)+'\n'+END+(note.trim()?'\n\n'+note.trim():'');
 }
 function decode(text){
  if(!String(text).startsWith(START+'\n'))return null;
  const end=text.indexOf('\n'+END);if(end<0||end>12000)return null;
  const lines=text.slice(START.length+1,end).split('\n'),title=lines.shift();
  const at=lines.findIndex(line=>line.startsWith('局号：'));if(at<0)return null;
  const id=lines.splice(at,1)[0].slice(3);return {title,lines:lines.filter(line=>!line.startsWith('已结算：')).map(line=>line.startsWith('赌注：')?line.replace(/；(?:Ta|\S{1,24}) 喝$/,''):line),id,note:text.slice(end+END.length+1).trim()};
 }
 function card(d,{open,remove}={}){
  const box=document.createElement('div');box.className='bar-result-card';
  const body=document.createElement(open?'button':'div');body.className='bar-result-body';
  if(open){body.type='button';body.onclick=open;body.title='返回查看结果';}
  const kicker=document.createElement('small');kicker.textContent='AFTERHOURS · '+(d.label||'游戏结果');
  const title=document.createElement('strong');title.textContent=d.title;
  body.append(kicker,title);
  for(const line of d.lines){const p=document.createElement('span');p.textContent=line;body.append(p);}
  box.append(body);
  if(remove){const x=document.createElement('button');x.type='button';x.className='bar-result-remove';x.textContent='×';x.setAttribute('aria-label','移除游戏结果');x.onclick=remove;box.append(x);}
  return box;
 }
 function cleanMessage(text){if(!String(text).startsWith(START+'\n'))return text;return text.replace(/^已结算：.*\n?/gm,'').replace(/^(赌注：.*)；(?:Ta|\S{1,24}) 喝$/gm,'$1');}
 function eventParts(text){
  const parts=String(text).split(/(\n)/).map(line=>{
   let m;   // 旧消息里的名字是什么就认什么，不只认 mamo
   if((m=line.match(new RegExp('^🎲 '+NAME+' 把吧台游戏交给你选：([^\\n]+)$','u'))))return {label:'Ta来选',title:m[1]+' 邀你选游戏',lines:[m[2]]};
   if((m=line.match(new RegExp('^📜 '+NAME+' 把酒单推到你面前：([^\\n]+)$','u'))))return {label:'递酒单',title:m[1]+' 递来酒单',lines:[m[2]]};
   if(new RegExp('^[🍵🍶] '+NAME+' 把一杯.+放到你面前。$','u').test(line))return {label:'递一杯',title:line.replace(/^[🍵🍶] /u,''),lines:[]};
   if(new RegExp('^🎲 '+NAME+' 端来今日特调「.+」：.+$','u').test(line)){const at=line.indexOf('：');return {label:'今日特调',title:line.slice(3,at),lines:[line.slice(at+1)]};}
   return line;
  });
  return parts.some(p=>typeof p==='object')?parts:null;
 }
 const api={describe,encode,decode,card,cleanMessage,eventParts,setPlayer};root.MamoBarResult=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
