/* Trades: calculator for 2 to 4 teams, and win-win trade suggestions */
const MAX_TRADE_TEAMS=4;
function teamAssets(t){
  const pl=t.players.map(id=>({k:'p:'+id,label:S.P[id].n,sub:`${S.P[id].pos} ${S.P[id].team||'FA'}${S.P[id].age?', '+S.P[id].age:''}`,v:S.val[id]||0}));
  const pk=S.picks.filter(p=>p.owner===t.rid).map(p=>({k:p.key,label:pickLabel(p),sub:'Pick',v:pickValue(p)}));
  return pl.concat(pk).sort((a,b)=>b.v-a.v);
}
function assetOwner(k){if(k.startsWith('p:')){const id=k.slice(2);const t=S.teams.find(x=>x.players.includes(id));return t&&t.rid}const p=S.picks.find(x=>x.key===k);return p&&p.owner}
const assetLabel=k=>{if(k.startsWith('p:'))return (S.P[k.slice(2)]||{}).n;const p=S.picks.find(x=>x.key===k);return `${p.season} round ${p.round} (${S.byRid[p.orig].name}'s)`};
function lineupAfter(t,give,get){const L=t.players.filter(id=>!give.includes(id)).concat(get);return optimize(L.filter(id=>!t.reserve.has(id)&&!t.taxi.has(id)),ros).total}
/* team strength y seasons out after a trade: players with aging, picks as rookies */
function futureAfter(t,giveP,getP,giveK,getK,y){
  const s0=Number(S.season);
  const players=t.players.filter(id=>!giveP.includes(id)).concat(getP);
  const picks=(t.myPicks||[]).filter(p=>!giveK.includes(p.key)).concat(getK.map(k=>S.picks.find(p=>p.key===k)));
  const pool=players.filter(id=>S.P[id]).map(id=>({pos:S.P[id].pos,pts:ppgYear(id,y)}));
  const rk=picks.filter(pk=>pk.season-s0>=1&&pk.season-s0<=y).map(pk=>({pos:'WR',pts:rookiePpg(pk,y-(pk.season-s0))}));
  return optimizeItems(pool.concat(rk)).total;
}
function normTC(){
  if(!S.tc||!S.tc.teams){const a=S.meRid,b=(S.teams.find(t=>t.rid!==S.meRid)||{}).rid;S.tc={teams:[a,b],mv:{}}}
  for(const k in S.tc.mv){const m=S.tc.mv[k];if(!S.tc.teams.includes(m.from)||!S.tc.teams.includes(m.to)||m.from===m.to)delete S.tc.mv[k]}
}
function tradeEval(){
  const T=S.tc.teams.map(r=>S.byRid[r]);const mv=Object.entries(S.tc.mv);
  return T.map(t=>{
    const out=mv.filter(([k,m])=>m.from===t.rid).map(([k])=>k),inn=mv.filter(([k,m])=>m.to===t.rid).map(([k])=>k);
    const vo=out.map(assetVal),vi=inn.map(assetVal);
    const adj=vs=>vs.reduce((s,v)=>s+Math.pow(v,1.15),0);
    const P=ks=>ks.filter(k=>k.startsWith('p:')).map(k=>k.slice(2)),K=ks=>ks.filter(k=>!k.startsWith('p:'));
    const now=lineupAfter(t,P(out),P(inn))-t.rosMean;
    const fut=S.isDynasty&&t.fut?futureAfter(t,P(out),P(inn),K(out),K(inn),2)-t.fut[2].total:null;
    return{t,out,inn,sent:vo.reduce((a,b)=>a+b,0),got:vi.reduce((a,b)=>a+b,0),adjSent:adj(vo),adjGot:adj(vi),now,fut};
  });
}
function rTrade(){
  normTC();const E=tradeEval(),n=E.length;
  const inTrade=new Set(S.tc.teams);const moves=Object.keys(S.tc.mv).length;
  const panel=e=>{const t=e.t,others=S.tc.teams.filter(r=>r!==t.rid);
    return `<div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:10px"><div><div class="pname">${h(t.name)}</div><div class="psub">sends ${e.out.length} ${e.out.length===1?'asset':'assets'}, gets ${e.inn.length}</div></div>
      ${n>2?`<button class="btn ghost" data-tcrm="${t.rid}" aria-label="Remove ${h(t.name)} from trade">Remove</button>`:''}</div>
      <div class="assets">${teamAssets(t).map(a=>{const m=S.tc.mv[a.k];return `<div class="tc-a${m?' on':''}"><label><input type="checkbox" data-asset="${h(a.k)}" data-from="${t.rid}" ${m?'checked':''}><span><span class="pname">${h(a.label)}</span> <span class="psub">${h(a.sub)}</span></span></label>
        ${m&&n>2?`<select data-dest="${h(a.k)}" aria-label="Send to">${others.map(r=>`<option value="${r}" ${m.to===r?'selected':''}>to ${h(S.byRid[r].name)}</option>`).join('')}</select>`:''}<span class="v">${f0(a.v)}</span></div>`}).join('')}</div></div>`};
  const addable=S.teams.filter(t=>!inTrade.has(t.rid));
  let res='';
  if(moves){
    const totAdj=E.reduce((s,e)=>s+e.adjGot,0)||1;
    const net=E.map(e=>({e,d:(e.adjGot-e.adjSent)/totAdj}));const worst=[...net].sort((a,b)=>a.d-b.d)[0],best=[...net].sort((a,b)=>b.d-a.d)[0];
    const spread=best.d-worst.d;
    const verdict=spread<.1?'Fair trade':spread<.25?`${best.e.t.name} slightly wins this trade`:`${best.e.t.name} wins this trade`;
    let fix='';
    if(spread>=.1){const gap=(best.e.got-best.e.sent)-(worst.e.got-worst.e.sent);
      const c=teamAssets(best.e.t).filter(a=>!S.tc.mv[a.k]&&a.v>0).sort((x,y)=>Math.abs(x.v-gap/2)-Math.abs(y.v-gap/2))[0];
      if(c)fix=`<p style="margin:10px 0 0">To even it out, ${h(best.e.t.name)} could add <b>${h(c.label)}</b> (${f0(c.v)}) going to ${h(worst.e.t.name)}.</p>`}
    res=`<div class="panel" style="margin-top:16px"><div class="verdict">${h(verdict)}</div>
      <div class="scroll"><table style="margin-top:10px"><thead><tr><th>Team</th><th>Gets</th><th class="r">Sends</th><th class="r">Receives</th><th class="r">Net value</th><th class="r">Lineup now</th>${S.isDynasty?'<th class="r">In 2 years</th>':''}</tr></thead><tbody>
      ${E.map(e=>{const nv=e.got-e.sent;return `<tr><td class="pname">${h(e.t.name)}</td><td class="psub">${e.inn.map(k=>h(assetLabel(k))).join(', ')||'Nothing'}</td>
        <td class="r num">${f0(e.sent)}</td><td class="r num">${f0(e.got)}</td><td class="r num ${nv>=0?'up':'down'}">${nv>=0?'+':''}${f0(nv)}</td>
        <td class="r num ${e.now>=0?'up':'down'}">${e.now>=0?'+':''}${f1(e.now)}/wk</td>${S.isDynasty?`<td class="r num ${e.fut>=0?'up':'down'}">${e.fut>=0?'+':''}${f1(e.fut)}/wk</td>`:''}</tr>`}).join('')}</tbody></table></div>${fix}</div>`;
  }
  let html=`<h2 id="tcTop">Trade calculator</h2><p class="lede">Up to ${MAX_TRADE_TEAMS} teams. Tick what each team sends${n>2?' and choose who gets it':''}. Value is ${h(S.valueSource)} with a consolidation premium, so one star beats two pieces that add up to the same number. Lineup now is the change in each team's best weekly lineup over the next four weeks${S.isDynasty?'; in 2 years uses the aging and draft-pick model from Forecast':''}.</p>
  <div class="row">${n<MAX_TRADE_TEAMS&&addable.length?`<select id="tcAdd" aria-label="Add a team"><option value="">Add a team to the trade</option>${addable.map(t=>`<option value="${t.rid}">${h(t.name)}</option>`).join('')}</select>`:''}
    ${n===2?`<select id="tcSwap" aria-label="Trade partner">${S.teams.filter(t=>t.rid!==S.tc.teams[0]).map(t=>`<option value="${t.rid}" ${t.rid===S.tc.teams[1]?'selected':''}>Partner: ${h(t.name)}</option>`).join('')}</select>`:''}
    ${moves?'<button class="btn ghost" id="tcClear">Clear trade</button>':''}</div>
  <div class="tl tl-${n}">${E.map(panel).join('')}</div>${res}`;
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
function tcRerender(){const y=window.scrollY;render();window.scrollTo(0,y)}
document.addEventListener('change',e=>{
  if(S.tab!=='trade')return;const el=e.target;
  if(el.id==='tcAdd'&&el.value){S.tc.teams.push(Number(el.value));tcRerender();return}
  if(el.id==='tcSwap'){S.tc.teams[1]=Number(el.value);S.tc.mv={};tcRerender();return}
  if(el.dataset.asset){const k=el.dataset.asset,from=Number(el.dataset.from);
    if(el.checked){const others=S.tc.teams.filter(r=>r!==from);S.tc.mv[k]={from,to:others[0]}}else delete S.tc.mv[k];tcRerender();return}
  if(el.dataset.dest){const m=S.tc.mv[el.dataset.dest];if(m)m.to=Number(el.value);tcRerender()}
});
document.addEventListener('click',e=>{
  if(S.tab!=='trade')return;
  const rm=e.target.closest('[data-tcrm]');if(rm){const r=Number(rm.dataset.tcrm);S.tc.teams=S.tc.teams.filter(x=>x!==r);tcRerender();return}
  if(e.target.id==='tcClear'){S.tc.mv={};tcRerender();return}
  const ld=e.target.closest('[data-load]');if(ld){const s=S.suggest[Number(ld.dataset.load)];const mv={};
    s.give.forEach(id=>mv['p:'+id]={from:S.meRid,to:s.rid});s.get.forEach(id=>mv['p:'+id]={from:s.rid,to:S.meRid});
    S.tc={teams:[S.meRid,s.rid],mv};render();$('#tcTop').scrollIntoView({behavior:'smooth'})}
});
registerModule({key:'trade',label:'Trades',order:50,render:rTrade,after(){if(!S.suggest)setTimeout(()=>{S.suggest=suggestTrades();if(S.tab==='trade')render()},30)}});
