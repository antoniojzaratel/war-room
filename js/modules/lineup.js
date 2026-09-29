/* Lineup: optimal lineup by points, by chance to beat this week's opponent (upside mode), and over the next four weeks */
function currentVsOptimal(t,fn){
  const cur=S.slots.map((s,i)=>({slot:s,id:t.starters[i]&&t.starters[i]!=='0'?t.starters[i]:null}));
  const fixed=new Set();const out=cur.map(c=>({slot:c.slot,id:null}));
  const lk=S.planWeek===S.week;cur.forEach((c,i)=>{if(lk&&c.id&&isLocked(c.id)){out[i].id=c.id;out[i].locked=true;fixed.add(c.id)}});
  const pool=startable(t).filter(id=>!fixed.has(id)&&!(lk&&isLocked(id))).map(id=>({id,pos:S.P[id].pos,pts:fn(id)})).sort((a,b)=>b.pts-a.pts);
  const used=new Set();
  const order=out.map((o,i)=>i).filter(i=>!out[i].id).sort((a,b)=>ORD.indexOf(out[a].slot)-ORD.indexOf(out[b].slot));
  for(const i of order){const c=pool.find(p=>!used.has(p.id)&&ELIG[out[i].slot].includes(p.pos));if(c){used.add(c.id);out[i].id=c.id}}
  const tot=a=>a.reduce((s,x)=>s+(x.id?fn(x.id):0),0);
  return{cur,opt:out,curT:tot(cur),optT:tot(out)};
}

/* ---------- upside mode: maximise the chance of beating this week's opponent ---------- */
function weekDist(id){
  const lk=S.planWeek===S.week;
  if(lk&&isLocked(id)){let act=0;for(const m of S.mu[S.week]||[])if((m.players_points||{})[id]!=null)act=m.players_points[id];const lp=livePlayer(id,act);return{mean:lp.mean,sd:Math.max(.1,lp.sd)}}
  const m=wkPlan(id);return{mean:m,sd:playerSd(id,m)};
}
function oppLineup(rid){
  const w=S.planWeek,p=pairsOf(S.mu[w]).find(x=>x.some(m=>m.roster_id===rid));if(!p)return null;
  const om=p.find(m=>m.roster_id!==rid),o=S.byRid[om.roster_id];
  let ids=(om.starters||[]).filter(id=>id&&id!=='0'&&S.P[id]);
  const assumed=!ids.length||S.planWeek!==S.week;
  if(assumed)ids=optimize(startable(o),wkPlan).lineup.map(x=>x.id).filter(Boolean);
  let mean=0,v=0;ids.forEach(id=>{const d=weekDist(id);mean+=d.mean;v+=d.sd*d.sd});
  return{t:o,ids,mean,sd:Math.sqrt(v),assumed};
}
function winProb(lineup,opp){let m=0,v=0;lineup.forEach(x=>{if(x.id){const d=weekDist(x.id);m+=d.mean;v+=d.sd*d.sd}});return{p:Phi((m-opp.mean)/Math.sqrt(v+opp.sd*opp.sd)),mean:m,sd:Math.sqrt(v)}}
function winLineup(t,opp,base){
  let L=base.map(x=>({...x}));let best=winProb(L,opp);
  const pool=startable(t).filter(id=>!(S.planWeek===S.week&&isLocked(id)));
  for(let it=0;it<25;it++){let move=null;
    const inL=new Set(L.map(x=>x.id));
    L.forEach((x,i)=>{if(x.locked)return;
      for(const c of pool){if(inL.has(c)||!ELIG[x.slot].includes(S.P[c].pos))continue;
        const T=L.map((y,k)=>k===i?{...y,id:c}:y);const r=winProb(T,opp);if(r.p>best.p+1e-4&&(!move||r.p>move.r.p))move={T,r}}
      // shuffle within the lineup: move a starter to this slot and fill his old slot from the bench
      L.forEach((y,k)=>{if(k===i||y.locked||!y.id||!ELIG[x.slot].includes(S.P[y.id].pos))return;
        for(const c of pool){if(inL.has(c)||!ELIG[y.slot].includes(S.P[c].pos))continue;
          const T=L.map((z,q)=>q===i?{...z,id:y.id}:q===k?{...z,id:c}:z);const r=winProb(T,opp);if(r.p>best.p+1e-4&&(!move||r.p>move.r.p))move={T,r}}});
    });
    if(!move)break;L=move.T;best=move.r;
  }
  return{lineup:L,...best};
}

function rLineup(){
  const t=S.byRid[S.lineupTeam];const mode=S.lineupMode;
  const opts=S.teams.map(x=>`<option value="${x.rid}" ${x.rid===t.rid?'selected':''}>${h(x.name)}${x.rid===S.meRid&&S.inLeague?' (you)':''}</option>`).join('');
  const head=`<h2>Optimal lineup</h2><p class="lede">${mode==='win'?`Upside mode: instead of the most projected points, this picks the lineup with the best chance to beat your week ${S.planWeek} opponent. When you're the underdog it reaches for boom players with a high ceiling, even if they project a little less; when you're the favorite it prefers steady ones.`:'Built from Sleeper projections scored with your league’s exact settings. Players whose games already kicked off stay locked where they are.'}</p>
  <div class="row"><select id="luTeam" aria-label="Team">${opts}</select>
    <div class="chips" role="group" aria-label="Optimise for"><button class="chip" data-lm="week" aria-pressed="${mode==='week'}">Most points, week ${S.planWeek}</button><button class="chip" data-lm="win" aria-pressed="${mode==='win'}">Best chance to win, week ${S.planWeek}</button><button class="chip" data-lm="ros" aria-pressed="${mode==='ros'}">Next 4 weeks</button></div></div>`;
  if(mode==='win')return head+(needsPro('upside')?proCard('upside'):rWinMode(t));
  const fn=mode==='week'?wkPlan:ros;const r=currentVsOptimal(t,fn);
  const gain=r.optT-r.curT;const curSet=new Set(r.cur.map(x=>x.id)),optSet=new Set(r.opt.map(x=>x.id));
  const ins=[...optSet].filter(id=>id&&!curSet.has(id)),outs=[...curSet].filter(id=>id&&!optSet.has(id));
  const bench=startable(t).filter(id=>!optSet.has(id)).sort((a,b)=>fn(b)-fn(a));
  return head+`<div class="panel" style="margin-bottom:16px">${gain>.05?`<div class="verdict up">+${f1(gain)} points available</div><p style="margin:6px 0 0">${ins.map((id,i)=>`Start <b>${h(S.P[id].n)}</b> (${f1(fn(id))})${outs[i]?` over <b>${h(S.P[outs[i]].n)}</b> (${f1(fn(outs[i]))})`:''}`).join('. ')}.</p>`:
    `<div class="verdict">This lineup is already optimal</div><p class="mute" style="margin:6px 0 0">Projected ${f1(r.curT)} points.</p>`}</div>
  <div class="grid2">
   <div class="panel"><h3 style="margin-top:0">Current starters, ${f1(r.curT)}</h3>${luTable(r.cur,fn)}</div>
   <div class="panel"><h3 style="margin-top:0">Optimal, ${f1(r.optT)}</h3>${luTable(r.opt,fn)}</div>
  </div>
  <h3>Bench</h3><div class="panel scroll"><table><thead><tr><th>Player</th><th class="r">Week ${S.planWeek}</th><th class="r">Next 4 avg</th><th class="r">Value</th></tr></thead><tbody>
  ${bench.map(id=>`<tr><td>${pcell(id)}</td><td class="r num">${f1(wkPlan(id))}</td><td class="r num">${f1(ros(id))}</td><td class="r num">${f0(S.val[id])}</td></tr>`).join('')}</tbody></table></div>`;
}
function rWinMode(t){
  const opp=oppLineup(t.rid);
  if(!opp)return `<div class="panel">No opponent for ${h(t.name)} in week ${S.planWeek}, so there's nothing to beat. Use Most points instead.</div>`;
  const base=currentVsOptimal(t,wkPlan).opt,cur=currentVsOptimal(t,wkPlan).cur;
  const W=winLineup(t,opp,base),P0=winProb(base,opp),Pc=winProb(cur,opp);
  const baseSet=new Set(base.map(x=>x.id)),winSet=new Set(W.lineup.map(x=>x.id));
  const ins=[...winSet].filter(id=>id&&!baseSet.has(id)),outs=[...baseSet].filter(id=>id&&!winSet.has(id));
  const dist=id=>weekDist(id);
  const fav=P0.p>=.5;
  const row=x=>{if(!x.id)return `<tr><td>${posTag(x.slot)}</td><td class="flag">Empty</td><td></td><td></td><td></td></tr>`;const d=dist(x.id);
    return `<tr><td>${posTag(x.slot)}</td><td>${pcell(x.id)}${x.locked?' <span class="tag">Locked</span>':''}${ins.includes(x.id)?' <span class="tag good">Upside pick</span>':''}</td><td class="r num">${f1(d.mean)}</td><td class="r num mute">${f1(floorOf(d.mean,d.sd))}</td><td class="r num">${f1(ceilOf(d.mean,d.sd))}</td></tr>`};
  const tbl=L=>`<div class="scroll"><table><thead><tr><th>Slot</th><th>Player</th><th class="r">Proj</th><th class="r">Floor</th><th class="r">Ceiling</th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div>`;
  const booms=startable(t).filter(id=>!winSet.has(id)&&S.P[id].pos!=='K'&&S.P[id].pos!=='DEF').map(id=>({id,...dist(id)})).filter(x=>x.mean>0).sort((a,b)=>ceilOf(b.mean,b.sd)-ceilOf(a.mean,a.sd)).slice(0,6);
  const oppRows=opp.ids.map(id=>{const d=dist(id);return `<tr><td>${pcell(id)}</td><td class="r num">${f1(d.mean)}</td><td class="r num">${f1(ceilOf(d.mean,d.sd))}</td></tr>`}).join('');
  return `<div class="board fc-board" style="margin-bottom:16px"><div style="position:relative;z-index:1">
    <div class="tname">${h(t.name)} vs ${h(opp.t.name)}, week ${S.planWeek}</div>
    <div class="sub" style="margin-bottom:12px">${fav?'You’re the favorite, so steady players protect the lead.':'You’re the underdog, so higher-ceiling players give you more ways to steal the win.'}${opp.assumed?` Assumes ${h(opp.t.name)} starts its best projected lineup.`:''}</div>
    <div class="fc-whatif">
      <div><div class="psub">Current starters</div><div class="num fc-big">${pc(Pc.p)}</div></div>
      <div><div class="psub">Most-points lineup</div><div class="num fc-big">${pc(P0.p)}</div></div>
      <div><div class="psub">Best-chance lineup</div><div class="num fc-big">${pc(W.p)}</div></div>
      <div><div class="psub">Projected score</div><div class="num fc-big">${f1(W.mean)} <span class="mute">vs</span> ${f1(opp.mean)}</div></div></div></div></div>
  <div class="panel" style="margin-bottom:16px">${ins.length?`<div class="verdict up">+${f1((W.p-P0.p)*100)} points of win probability</div><p style="margin:6px 0 0">${ins.map((id,i)=>{const a=dist(id),b=outs[i]?dist(outs[i]):null;return `Start <b>${h(S.P[id].n)}</b> (proj ${f1(a.mean)}, ceiling ${f1(ceilOf(a.mean,a.sd))})${b?` over <b>${h(S.P[outs[i]].n)}</b> (proj ${f1(b.mean)}, ceiling ${f1(ceilOf(b.mean,b.sd))})`:''}`}).join('. ')}.</p>`:
    `<div class="verdict">The most-points lineup is also your best chance to win</div><p class="mute" style="margin:6px 0 0">No swap on your bench raises your ${pc(P0.p)} win probability.</p>`}</div>
  <div class="grid2"><div class="panel"><h3 style="margin-top:0">Best-chance lineup</h3>${tbl(W.lineup)}</div>
    <div class="panel"><h3 style="margin-top:0">${h(opp.t.name)}${opp.assumed?', projected lineup':''}</h3><div class="scroll"><table><thead><tr><th>Player</th><th class="r">Proj</th><th class="r">Ceiling</th></tr></thead><tbody>${oppRows}</tbody></table></div></div></div>
  ${booms.length?`<h3>Boom candidates on your bench</h3><p class="psub" style="margin:-4px 0 10px">Floor and ceiling are a bad week and a big week (roughly 1 in 10 each), from each player's real week-to-week swings in this league.</p>
  <div class="panel scroll"><table><thead><tr><th>Player</th><th class="r">Proj</th><th class="r">Floor</th><th class="r">Ceiling</th></tr></thead><tbody>${booms.map(b=>`<tr><td>${pcell(b.id)}</td><td class="r num">${f1(b.mean)}</td><td class="r num mute">${f1(floorOf(b.mean,b.sd))}</td><td class="r num">${f1(ceilOf(b.mean,b.sd))}</td></tr>`).join('')}</tbody></table></div>`:''}`;
}
function luTable(arr,fn){return `<div class="scroll"><table><tbody>${arr.map(x=>`<tr><td>${posTag(x.slot)}</td><td>${x.id?pcell(x.id):'<span class="flag">Empty</span>'}${x.locked?' <span class="tag">Locked</span>':''}</td><td class="r num" style="font-size:18px">${x.id?f1(fn(x.id)):'0.0'}</td></tr>`).join('')}</tbody></table></div>`}
document.addEventListener('change',e=>{if(e.target.id==='luTeam'){S.lineupTeam=Number(e.target.value);render()}});
document.addEventListener('click',e=>{const lm=e.target.closest('[data-lm]');if(lm){S.lineupMode=lm.dataset.lm;render()}});
registerModule({key:'lineup',label:'Lineup',order:20,live:true,render:rLineup});
