/* Isolated game rules. No network, chat, alcohol ledger or storage writes. */
(function(root){
  'use strict';
  function randomInt(max){
    const a=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;
    do{root.crypto.getRandomValues(a);}while(a[0]>=limit);
    return a[0]%max;
  }
  function create({kind='dice',mode=1,wager,random=randomInt}={}){
    if(!['dice','hands'].includes(kind)||![1,3].includes(mode))throw Error('Invalid game');
    const state={id:root.crypto.randomUUID(),kind,mode,wager:JSON.parse(JSON.stringify(wager||{type:'truth'})),rounds:[],me:0,ta:0,done:false,winner:null,question:''};
    function play(choice){
      if(state.done)throw Error('Round already complete');
      if(kind==='hands'&&![0,1,2].includes(choice))throw Error('Choose a hand first');
      const me=kind==='dice'?random(6)+1:choice,ta=random(kind==='dice'?6:3)+(kind==='dice'?1:0);
      const winner=me===ta?'tie':kind==='dice'?(me>ta?'me':'ta'):((me-ta+3)%3===1?'me':'ta');
      state.rounds.push({me,ta,winner});
      if(kind==='dice'){state.me+=me;state.ta+=ta;state.done=state.rounds.length===mode;}
      else{if(winner!=='tie')state[winner]++;state.done=mode===1||Math.max(state.me,state.ta)===2;}
      if(state.done)state.winner=state.me===state.ta?'tie':state.me>state.ta?'me':'ta';
      return {me,ta,winner};
    }
    function payload(){
      if(!state.done||state.winner==='tie')throw Error('A decisive result is required');
      const needsQuestion=state.winner==='me'&&['truth','dare'].includes(state.wager.type);
      if(needsQuestion&&!state.question.trim())throw Error('Write the question first');
      return JSON.parse(JSON.stringify({...state,question:state.question.trim(),status:'pending',source:'bar-game'}));
    }
    return {state,play,payload,restart:()=>create({kind,mode,wager:state.wager,random})};
  }
  const api={create,randomInt};if(typeof module!=='undefined')module.exports=api;root.MamoBarGameEngine=api;
})(typeof window!=='undefined'?window:globalThis);
