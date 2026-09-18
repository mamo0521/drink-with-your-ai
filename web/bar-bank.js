/* Question bank parser. Markdown in, plain lists out; no network or storage writes. */
(function(root){
  'use strict';
  // Two banks in one file: `# 真心话·题库` holds questions the player asks Ta, `# 盲品·题库`
  // holds tasks the player performs (opposite directions, so never mixed — mamo 2026-09-17).
  // Inside a bank `## 亲密` is the pool behind the switch; other `##` names are just categories.
  function parse(raw){
    const banks={};let bank=null,tag='';
    for(const line of String(raw||'').split(/\r?\n/)){
      let m;
      if((m=line.match(/^#\s+(.+?)\s*$/))){bank=banks[m[1]]||=[];tag='';}
      else if((m=line.match(/^##\s+(.+?)\s*$/))){tag=m[1];bank||=banks['']||=[];}
      else if(bank&&(m=line.match(/^\s*(?:[-*]|\d+[.、])\s+(.+?)\s*$/)))bank.push({tag,text:m[1]});
    }
    return banks;
  }
  function bank(raw,name){const banks=parse(raw);const key=Object.keys(banks).find(k=>k.includes(name));return key?banks[key]:[];}
  const TIERS=['轻','中','重'];
  function tierOf(tag){if(/亲密/.test(tag))return '亲密';return TIERS.find(t=>tag.includes(t))||'';}
  // Every entry of one bank, the intimate pool only when the switch is on.
  function pool(raw,name,intimate=false){
    const out=[];
    for(const q of bank(raw,name)){
      const tier=tierOf(q.tag);
      if(tier==='亲密'&&!intimate)continue;
      out.push({tag:tier||q.tag,tier,text:q.text});
    }
    return out;
  }
  // Draw without repeats; entries in `avoid` come back only when the rest run out.
  function draw(list,count,random,avoid=[]){
    const pick=pool=>{const out=[];pool=[...pool];while(out.length<count&&pool.length)out.push(pool.splice(random(pool.length),1)[0]);return out;};
    const fresh=pick(list.filter(q=>!avoid.includes(q)));
    return fresh.length<count?[...fresh,...pick(list.filter(q=>!fresh.includes(q))).slice(0,count-fresh.length)]:fresh;
  }
  // The intimate switch lives per device; both games read the same key.
  const KEY='bar:intimate';
  function intimate(){try{return root.localStorage.getItem(KEY)==='1';}catch(e){return false;}}
  function setIntimate(on){try{root.localStorage.setItem(KEY,on?'1':'0');}catch(e){}root.document?.querySelectorAll('.bar-intimate-switch').forEach(n=>n.setAttribute('aria-checked',String(!!on)));return !!on;}
  function createSwitch(onChange){
    const doc=root.document,b=doc.createElement('button');b.type='button';b.className='bar-intimate-switch';b.setAttribute('role','switch');b.setAttribute('aria-label','亲密题');b.setAttribute('aria-checked',String(intimate()));
    const label=doc.createElement('span');label.textContent='亲密题';const track=doc.createElement('span');track.className='bar-switch-track';track.setAttribute('aria-hidden','true');const knob=doc.createElement('span');knob.className='bar-switch-knob';track.append(knob);b.append(label,track);
    b.onclick=()=>{const on=setIntimate(!intimate());b.setAttribute('aria-checked',String(on));onChange?.(on);};return b;
  }
  const api={parse,bank,pool,tierOf,draw,intimate,setIntimate,createSwitch};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.MamoBarBank=api;
})(typeof window!=='undefined'?window:globalThis);
