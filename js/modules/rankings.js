/* Rankings: team power and dynasty rankings, player rankings with tiers, and a start/sit comparison */
function rRankTeams(){
  const T=[...S.teams].sort((a,b)=>a.pRank-b.pRank),sim=S.sim||{};
  const maxR=Math.max(...S.teams.map(t=>t.rosMean));
  let html=`<h2>Power rankings</h2><p class="lede">35% all-play record (how you'd do against everyone every week), 15% actual record, 50% the strength of each team's best lineup over the next four weeks. Playoff and title odds come from ${S.sim?'3,000+':'a'} simulated seasons on the real schedule.</p>
  <div class="panel scroll"><table><thead><tr><th>#</th><th>Team</th><th class="r">Record</th><th class="r">Points for</th><th class="r">All-play</th><th>Lineup strength</th><th class="r">Proj. wins</th><th class="r">Playoffs</th><th class="r">Bye</th><th class="r">Title</th></tr></thead><tbody>
  ${T.map(t=>{const s=sim[t.rid]||{};return `<tr class="${t.rid===S.meRid?'me':''}"><td class="num" style="font-size:20px">${t.pRank}</td>
    <td><div class="pname">${h(t.name)}</div><div class="psub">@${h(t.handle)}</div></td>
    <td class="r num">${t.w}-${t.l}${t.t?'-'+t.t:''}</td><td class="r num">${f1(t.pf)}</td>
    <td class="r num">${t.ap==null?'<span class="mute">n/a</span>':pc(t.ap)}</td>
    <td style="min-width:140px"><div class="bar"><i style="width:${t.rosMean/maxR*100}%"></i></div><div class="psub">${f1(t.rosMean)} per week</div></td>
    <td class="r num">${f1(s.wins)}</td><td class="r num">${pc(s.po)}</td><td class="r num">${pc(s.bye)}</td><td class="r num">${pc(s.champ)}</td></tr>`}).join('')}
  </tbody></table></div><div class="row" style="margin-top:10px"><button class="btn ghost" id="btnSim">Rerun 6,000 simulations</button></div>`;
  const D=[...S.teams].sort((a,b)=>a.dRank-b.dRank);const maxD=Math.max(...D.map(t=>t.dTotal));
  html+=`<h2>${S.isDynasty?'Dynasty power rankings':'Keeper value rankings'}</h2><p class="lede">Total asset value: starters at full value, the best eight bench players at 35%, and owned draft picks at 60%, with picks priced by where the original team is likely to finish. Values from ${h(S.valueSource)}.</p>
  <div class="panel scroll"><table><thead><tr><th>#</th><th>Team</th><th>Window</th><th>Total value</th><th class="r">Starters</th><th class="r">Bench</th><th class="r">Picks</th><th class="r">Starter age</th><th class="r">Win-now rank</th></tr></thead><tbody>
  ${D.map(t=>`<tr class="${t.rid===S.meRid?'me':''}"><td class="num" style="font-size:20px">${t.dRank}</td><td><div class="pname">${h(t.name)}</div><div class="psub">${t.myPicks.filter(p=>p.round===1).length} first-round picks</div></td>
    <td><span class="tag ${({good:'good',bad:'bad'})[OUTLOOK[t.outlook].tone]||''}">${h(t.tier)}</span></td>
    <td style="min-width:140px"><div class="bar"><i style="width:${t.dTotal/maxD*100}%;background:var(--amber)"></i></div><div class="psub">${f0(t.dTotal)}</div></td>
    <td class="r num">${f0(t.dStart)}</td><td class="r num">${f0(t.dBench)}</td><td class="r num">${f0(t.dPicks)}</td><td class="r num">${t.age?f1(t.age):'n/a'}</td><td class="r num">${t.nowRank}</td></tr>`).join('')}
  </tbody></table></div>`;
  return html;
}

document.addEventListener('click',e=>{if(e.target.id==='btnSim'){S.sim=simulate(6000);S.bookM=null;S.whatIf=null;render()}});

const RK={sec:'teams',pos:'ALL',mode:null,ss:null};
const RSECS=[['teams','Teams'],['players','Players'],['ss','Start/Sit']];
function rRank(){
  const body={teams:rRankTeams,players:rRankPlayers,ss:rStartSit}[RK.sec]||rRankTeams;
  return `<nav class="chips" style="margin:4px 0 6px" aria-label="Rankings sections">${RSECS.map(([k,l])=>`<button class="chip" data-rk="${k}" aria-pressed="${RK.sec===k}">${l}</button>`).join('')}</nav>${body()}`;
}
/* ---------- player rankings with tiers ---------- */
function ownerTag(id){const t=S.teams.find(x=>x.players.includes(id));return t?`<span class="tag ${t.rid===S.meRid?'good':''}">${h(t.name)}</span>`:'<span class="tag">Free agent</span>'}
function rRankPlayers(){
  if(!RK.mode)RK.mode=S.isDynasty?'dyn':'week';
  const modes=[['week',`Week ${S.planWeek}`],['ros','Rest of season'],...(S.isDynasty?[['dyn','Dynasty']]:[])];
  const fn=RK.mode==='dyn'?id=>S.val[id]||0:RK.mode==='ros'?ros:wkPlan;
  const allowK=RK.mode!=='dyn';
  const poss=['ALL','QB','RB','WR','TE',...(allowK?['K','DEF']:[])];if(!poss.includes(RK.pos))RK.pos='ALL';
  let ids=Object.keys(S.P).filter(id=>{const p=S.P[id];return p.team&&(RK.pos==='ALL'?['QB','RB','WR','TE'].includes(p.pos):p.pos===RK.pos)&&fn(id)>0});
  ids.sort((a,b)=>fn(b)-fn(a));ids=ids.slice(0,RK.pos==='ALL'?150:60);
  const posRank={};const cnt={};Object.keys(S.P).filter(id=>S.P[id].team&&fn(id)>0).sort((a,b)=>fn(b)-fn(a)).forEach(id=>{const p=S.P[id].pos;cnt[p]=(cnt[p]||0)+1;posRank[id]=p+cnt[p]});
  // tiers: a new tier starts when a player falls far enough below the tier's first player
  const thr=RK.mode==='dyn'?.18:.14;let tier=0,lead=null;const rows=[];
  ids.forEach((id,i)=>{const v=fn(id);if(lead==null||v<lead*(1-thr)){tier++;lead=v;rows.push(`<tr class="tier-row"><td colspan="7">Tier ${tier}</td></tr>`)}
    const sd=RK.mode==='dyn'?null:playerSd(id,RK.mode==='ros'?ros(id):wkPlan(id));
    rows.push(`<tr><td class="num">${i+1}</td><td>${pcell(id)}</td><td class="num">${posRank[id]}</td><td class="r num" style="font-size:17px">${RK.mode==='dyn'?f0(v):f1(v)}</td>
      <td class="r num mute">${sd!=null?`${f1(floorOf(v,sd))} to ${f1(ceilOf(v,sd))}`:(S.adp[id]?`ADP ${f1(S.adp[id])}`:'')}</td><td>${ownerTag(id)}</td></tr>`)});
  return `<h2>Player rankings</h2><p class="lede">${RK.mode==='dyn'?'Dynasty value from our model: production above replacement this season and the next three, with aging curves, blended with Sleeper’s dynasty ADP.':RK.mode==='ros'?'Average points per week over the next four weeks, scored with your league’s settings.':`Projected points for week ${S.planWeek}, scored with your league’s settings, with a bad-week floor and a big-week ceiling.`} Tiers group players with little separation between them.</p>
  <div class="row"><div class="chips">${modes.map(([k,l])=>`<button class="chip" data-rkm="${k}" aria-pressed="${RK.mode===k}">${l}</button>`).join('')}</div>
  <div class="chips">${poss.map(p=>`<button class="chip" data-rkp="${p}" aria-pressed="${RK.pos===p}">${p==='ALL'?'All':p}</button>`).join('')}</div></div>
  <div class="panel scroll"><table class="rk-tbl"><thead><tr><th>#</th><th>Player</th><th>Pos</th><th class="r">${RK.mode==='dyn'?'Value':'Proj'}</th><th class="r">${RK.mode==='dyn'?'Market':'Floor to ceiling'}</th><th>In your league</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
/* ---------- start/sit ---------- */
function ssDefault(){
  const me=S.byRid[S.meRid];const lu=optimize(startable(me),wkPlan);const flex=lu.lineup.filter(x=>x.id&&/FLEX/.test(x.slot)).pop()||lu.lineup.filter(x=>x.id).pop();
  const alt=flex&&lu.bench.find(b=>ELIG[flex.slot].includes(b.pos));return [flex&&flex.id,alt&&alt.id].filter(Boolean);
}
function rStartSit(){
  if(!RK.ss)RK.ss=ssDefault();
  const pool=Object.keys(S.P).filter(id=>S.P[id].team&&wkPlan(id)>0).sort((a,b)=>wkPlan(b)-wkPlan(a)).slice(0,500);
  const P=RK.ss.filter(id=>S.P[id]);
  let res='';
  if(P.length>=2){const N=20000,best={};P.forEach(id=>best[id]=0);const D=P.map(id=>({id,m:wkPlan(id),sd:playerSd(id,wkPlan(id))}));
    for(let n=0;n<N;n++){let b=null,bv=-1e9;for(const x of D){const v=x.m+x.sd*gauss();if(v>bv){bv=v;b=x.id}}best[b]++}
    const sorted=[...D].sort((a,b)=>best[b.id]-best[a.id]);const top=sorted[0],upside=[...D].sort((a,b)=>ceilOf(b.m,b.sd)-ceilOf(a.m,a.sd))[0];
    const second=sorted[1],close=(best[top.id]-best[second.id])/N<.04,safe=[...D].sort((a,b)=>floorOf(b.m,b.sd)-floorOf(a.m,a.sd))[0];
    res=`<div class="panel" style="margin-top:14px">${close?`<div class="verdict">Too close to call</div><p style="margin:6px 0 0">${h(S.P[top.id].n)} and ${h(S.P[second.id].n)} come out on top about equally often. If you’re the underdog this week, take the higher ceiling: <b>${h(S.P[upside.id].n)}</b> (${f1(ceilOf(upside.m,upside.sd))}). If you’re favored, take the higher floor: <b>${h(S.P[safe.id].n)}</b> (${f1(floorOf(safe.m,safe.sd))}).</p>`
      :`<div class="verdict up">Start ${h(S.P[top.id].n)}</div><p style="margin:6px 0 0">He outscores the others in ${pc(best[top.id]/N)} of 20,000 simulated week ${S.planWeek}s.${upside.id!==top.id?` If you need a big week to win, <b>${h(S.P[upside.id].n)}</b> has the higher ceiling (${f1(ceilOf(upside.m,upside.sd))}).`:''}</p>`}</div>
    <div class="ss-grid">${sorted.map(x=>`<div class="panel"><div class="row" style="justify-content:space-between;margin:0 0 8px"><div>${pcell(x.id)}</div><button class="bk-x" data-ssrm="${x.id}" aria-label="Remove">×</button></div>
      <div class="num hx-big">${pc(best[x.id]/N)}</div><div class="psub">chance to score the most</div>
      <div class="ss-stats"><div><div class="psub">Proj</div><b class="num">${f1(x.m)}</b></div><div><div class="psub">Floor</div><b class="num">${f1(floorOf(x.m,x.sd))}</b></div><div><div class="psub">Ceiling</div><b class="num">${f1(ceilOf(x.m,x.sd))}</b></div></div>
      <div style="margin-top:8px">${ownerTag(x.id)}</div></div>`).join('')}</div>`}
  return `<h2>Start/Sit</h2><p class="lede">Compare up to four players for week ${S.planWeek}. Each player’s week is simulated 20,000 times from his projection and his real week-to-week swings; the pick is whoever finishes on top most often.</p>
  <div class="row">${P.length<4?`<input id="ssAdd" list="ssList" placeholder="Add a player" aria-label="Add a player" autocomplete="off"><datalist id="ssList">${pool.map(id=>`<option value="${h(S.P[id].n)} (${S.P[id].pos} ${S.P[id].team})"></option>`).join('')}</datalist>`:''}
    ${P.length?'<button class="btn ghost" id="ssClear">Clear</button>':''}</div>
  ${P.length<2?`<div class="panel">Add ${P.length?'one more player':'two players'} to compare.${P.length?` So far: ${h(S.P[P[0]].n)}.`:''}</div>`:res}`;
}
document.addEventListener('click',e=>{if(S.tab!=='rank')return;
  const r=e.target.closest('[data-rk]');if(r){RK.sec=r.dataset.rk;render();return}
  const m=e.target.closest('[data-rkm]');if(m){RK.mode=m.dataset.rkm;render();return}
  const p=e.target.closest('[data-rkp]');if(p){RK.pos=p.dataset.rkp;render();return}
  const x=e.target.closest('[data-ssrm]');if(x){RK.ss=RK.ss.filter(id=>id!==x.dataset.ssrm);render();return}
  if(e.target.id==='ssClear'){RK.ss=[];render()}});
document.addEventListener('change',e=>{if(e.target.id!=='ssAdd')return;const v=e.target.value;
  const id=Object.keys(S.P).find(k=>S.P[k].team&&`${S.P[k].n} (${S.P[k].pos} ${S.P[k].team})`===v);if(id&&!RK.ss.includes(id)){RK.ss.push(id);render()}});
document.addEventListener('wr:reset',()=>{RK.ss=null;RK.mode=null});
registerModule({key:'rank',label:'Rankings',order:30,render:rRank});
