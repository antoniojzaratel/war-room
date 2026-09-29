/* Trades: calculator and win-win trade suggestions */
function teamAssets(t){
  const pl=t.players.map(id=>({k:'p:'+id,label:S.P[id].n,sub:`${S.P[id].pos} ${S.P[id].team||'FA'}`,v:S.val[id]||0}));
  const pk=S.picks.filter(p=>p.owner===t.rid).map(p=>({k:p.key,label:pickLabel(p),sub:'Pick',v:pickValue(p)}));
  return pl.concat(pk).sort((a,b)=>b.v-a.v);
}
function lineupAfter(t,give,get){const L=t.players.filter(id=>!give.includes(id)).concat(get);return optimize(L.filter(id=>!t.reserve.has(id)&&!t.taxi.has(id)),ros).total}
function rTrade(){
  const A=S.byRid[S.tc.a],B=S.byRid[S.tc.b];
  const sel=(id,cur,other)=>`<select id="${id}">${S.teams.filter(t=>t.rid!==other).map(t=>`<option value="${t.rid}" ${t.rid===cur?'selected':''}>${h(t.name)}</option>`).join('')}</select>`;
  const list=(t,set,side)=>`<div class="assets">${teamAssets(t).map(a=>`<label><input type="checkbox" data-side="${side}" value="${a.k}" ${set.has(a.k)?'checked':''}><span><span class="pname">${h(a.label)}</span> <span class="psub">${h(a.sub)}</span></span><span class="v">${f0(a.v)}</span></label>`).join('')}</div>`;
  const ga=[...S.tc.ga],gb=[...S.tc.gb];const va=ga.map(assetVal),vb=gb.map(assetVal);
  const sa=va.reduce((a,b)=>a+b,0),sb=vb.reduce((a,b)=>a+b,0);
  const adj=vs=>vs.reduce((s,v)=>s+Math.pow(v,1.15),0);const aa=adj(va),ab=adj(vb);
  const share=aa+ab?aa/(aa+ab):.5; // share of value that A sends
  const pa=ga.filter(k=>k.startsWith('p:')).map(k=>k.slice(2)),pb=gb.filter(k=>k.startsWith('p:')).map(k=>k.slice(2));
  const dA=lineupAfter(A,pa,pb)-A.rosMean,dB=lineupAfter(B,pb,pa)-B.rosMean;
  let verdict='Pick assets on both sides';
  if(ga.length&&gb.length){const d=Math.abs(share-.5);verdict=d<.05?'Fair trade':share>.5?`${B.name} wins this trade`:`${A.name} wins this trade`;if(d>=.05&&d<.12)verdict=verdict.replace('wins','slightly wins');}
  let fix='';if(ga.length&&gb.length&&Math.abs(share-.5)>=.05){const gap=Math.abs(sa-sb);const payer=share>.5?B:A;const set=share>.5?S.tc.gb:S.tc.ga;
    const c=teamAssets(payer).filter(a=>!set.has(a.k)&&a.v>0).sort((x,y)=>Math.abs(x.v-gap)-Math.abs(y.v-gap))[0];
    if(c)fix=`<p style="margin:8px 0 0">To even it out, ${h(payer.name)} could add <b>${h(c.label)}</b> (${f0(c.v)}).</p>`}
  let html=`<h2 id="tcTop">Trade calculator</h2><p class="lede">Value is ${h(S.valueSource)} with a consolidation premium, so one star is worth more than two pieces that add up to the same number. Lineup impact shows how each team's best weekly lineup changes over the next four weeks.</p>
  <div class="tl">
    <div class="panel"><div class="row">${sel('tcA',A.rid,B.rid)}<span class="mute">sends</span></div>${list(A,S.tc.ga,'a')}</div>
    <div class="panel"><div class="row">${sel('tcB',B.rid,A.rid)}<span class="mute">sends</span></div>${list(B,S.tc.gb,'b')}</div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="verdict">${h(verdict)}</div>
   <div class="split" aria-hidden="true"><i style="width:${share*100}%"></i><i style="width:${(1-share)*100}%"></i></div>
   <div class="row" style="justify-content:space-between;margin:0"><span>${h(A.name)} sends <b class="num">${f0(sa)}</b></span><span>${h(B.name)} sends <b class="num">${f0(sb)}</b></span></div>
   <div class="row" style="justify-content:space-between;margin:6px 0 0"><span>Lineup impact <b class="num ${dA>=0?'up':'down'}">${dA>=0?'+':''}${f1(dA)}</b> per week</span><span>Lineup impact <b class="num ${dB>=0?'up':'down'}">${dB>=0?'+':''}${f1(dB)}</b> per week</span></div>${fix}
  </div>`;
  html+=`<h2>Trade ideas for ${h(S.byRid[S.meRid].name)}</h2><p class="lede">Every one-for-one and two-for-one deal with every team was tested. These are the ones where your weekly lineup gets better, the value is close to fair, and the other manager doesn't lose starting production, so they have a reason to accept.</p>`;
  if(!S.suggest)html+='<div class="status">Testing trades across the league…</div>';
  else if(!S.suggest.length)html+='<div class="panel">No win-win deals found right now. Your lineup is tough to upgrade without overpaying.</div>';
  else html+=`<div class="panel scroll"><table><thead><tr><th>Partner</th><th>You give</th><th>You get</th><th class="r">Your lineup</th><th class="r">Their lineup</th><th class="r">Value</th><th></th></tr></thead><tbody>
    ${S.suggest.map((s,i)=>`<tr><td>${h(S.byRid[s.rid].name)}</td><td>${s.give.map(id=>h(S.P[id].n)).join(' + ')}</td><td>${s.get.map(id=>h(S.P[id].n)).join(' + ')}</td>
    <td class="r num up">+${f1(s.gain)}</td><td class="r num ${s.their>=0?'up':'down'}">${s.their>=0?'+':''}${f1(s.their)}</td><td class="r num ${s.dv>=0?'up':'down'}">${s.dv>=0?'+':''}${f0(s.dv)}</td>
    <td><button class="btn ghost" data-load="${i}">Open in calculator</button></td></tr>`).join('')}</tbody></table></div>`;
  return html;
}
function suggestTrades(){
  const me=S.byRid[S.meRid];const res=[];const mine=me.players.filter(id=>(S.val[id]||0)>250&&!me.taxi.has(id));
  const V=id=>S.val[id]||0;
  for(const t of S.teams){if(t.rid===me.rid)continue;const theirs=t.players.filter(id=>V(id)>250);
    const ev=(give,get)=>{const g=lineupAfter(me,give,get)-me.rosMean;if(g<.6)return;const th=lineupAfter(t,get,give)-t.rosMean;if(th<-1.2)return;
      const dv=get.reduce((s,x)=>s+V(x),0)-give.reduce((s,x)=>s+V(x),0);
      res.push({rid:t.rid,give,get,gain:g,their:th,dv,score:g+.4*Math.max(0,th)+(S.isDynasty?dv/900:0)})};
    for(const b of theirs){const vb=V(b);
      for(const a of mine){const va=V(a);if(Math.abs(va-vb)/Math.max(va,vb)<=.15)ev([a],[b])}
      for(let i=0;i<mine.length;i++)for(let k=i+1;k<mine.length;k++){const x=V(mine[i]),y=V(mine[k]);if(Math.max(x,y)>=vb)continue;const s=x+y;if(s>=vb*.95&&s<=vb*1.35)ev([mine[i],mine[k]],[b])}}}
  res.sort((a,b)=>b.score-a.score);const seen=new Set(),out=[];
  for(const r of res){const k=r.get.join()+'|'+r.rid;if(seen.has(k))continue;seen.add(k);out.push(r);if(out.length>=12)break}
  return out;
}

document.addEventListener('change',e=>{
  if(e.target.id==='tcA'||e.target.id==='tcB'){S.tc[e.target.id==='tcA'?'a':'b']=Number(e.target.value);S.tc.ga.clear();S.tc.gb.clear();render()}
  if(e.target.dataset.side){const set=e.target.dataset.side==='a'?S.tc.ga:S.tc.gb;e.target.checked?set.add(e.target.value):set.delete(e.target.value);const y=window.scrollY;render();window.scrollTo(0,y)}});
document.addEventListener('click',e=>{const ld=e.target.closest('[data-load]');if(ld){const s=S.suggest[Number(ld.dataset.load)];S.tc={a:S.meRid,b:s.rid,ga:new Set(s.give.map(x=>'p:'+x)),gb:new Set(s.get.map(x=>'p:'+x))};render();$('#tcTop').scrollIntoView({behavior:'smooth'})}});
registerModule({key:'trade',label:'Trades',order:50,render:rTrade,after(){if(!S.suggest)setTimeout(()=>{S.suggest=suggestTrades();if(S.tab==='trade')render()},30)}});
