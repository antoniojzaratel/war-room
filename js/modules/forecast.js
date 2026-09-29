/* Forecast: champion and toilet bowl forecasts, full odds table, and what this week's result does to your season */
function fcBars(key,title,lede,color){
  const sim=S.sim||{};const rows=[...S.teams].map(t=>({t,p:(sim[t.rid]||{})[key]||0})).sort((a,b)=>b.p-a.p);const mx=Math.max(.0001,...rows.map(r=>r.p));
  return `<div class="panel"><h3 style="margin-top:0">${title}</h3><p class="psub" style="margin:-4px 0 10px">${lede}</p>
  ${rows.map((r,i)=>`<div class="fc-row ${r.t.rid===S.meRid?'fc-me':''}"><span class="num fc-rk">${i+1}</span><span class="fc-name">${h(r.t.name)}</span>
    <span class="fc-bar"><i style="width:${r.p/mx*100}%;background:${color}"></i></span><span class="num fc-p">${pc(r.p)}</span></div>`).join('')}</div>`;
}
function rForecast(){
  const sim=S.sim||{},me=S.byRid[S.meRid],regLeft=S.week<=S.regEnd;
  let whatIf='';
  if(regLeft&&pairsOf(S.mu[S.week]).some(p=>p.some(m=>m.roster_id===S.meRid))){
    if(!S.whatIf)S.whatIf={win:simulate(2500,{rid:S.meRid,win:true}),lose:simulate(2500,{rid:S.meRid,win:false})};
    const W=S.whatIf.win[S.meRid],L=S.whatIf.lose[S.meRid],opp=S.byRid[oppOfWeek(S.week,S.meRid)];
    const cell=(k,label)=>`<div><div class="psub">${label}</div><div class="num fc-big">${pc(W[k])} <span class="mute">vs</span> ${pc(L[k])}</div></div>`;
    whatIf=`<div class="board fc-board" style="margin-bottom:16px"><div style="position:relative;z-index:1">
      <div class="tname">What week ${S.week} against ${h(opp?opp.name:'your opponent')} is worth</div>
      <div class="sub" style="margin-bottom:12px">Your odds if you win, versus if you lose.</div>
      <div class="fc-whatif">${cell('po','Make the playoffs')}${cell('bye','First-round bye')}${cell('champ','Win the title')}${cell('toilet','Lose the toilet bowl')}</div></div></div>`;
  }
  const T=[...S.teams].sort((a,b)=>(sim[b.rid].champ-sim[a.rid].champ)||(sim[b.rid].wins-sim[a.rid].wins));
  return `<h2>Season forecast</h2><p class="lede">Every remaining regular-season game on your real schedule, then the playoff bracket and the toilet bowl, simulated ${regLeft?'3,000':'thousands of'} times. This week uses live projections; later weeks use each team's best lineup over the next four weeks.</p>
  ${whatIf}
  <div class="grid2">${fcBars('champ','Champion forecast','Chance of winning the title game.','var(--mint)')}
  ${fcBars('toilet','Toilet bowl loser forecast','Chance of missing the playoffs and then losing every consolation game down to the bottom.','var(--red)')}</div>
  <h3>Full odds</h3><div class="panel scroll"><table><thead><tr><th>Team</th><th class="r">Record</th><th class="r">Proj. wins</th><th class="r">Playoffs</th><th class="r">Bye</th><th class="r">#1 seed</th><th class="r">Champion</th><th class="r">Last place</th><th class="r">Toilet bowl</th></tr></thead><tbody>
  ${T.map(t=>{const s=sim[t.rid];return `<tr class="${t.rid===S.meRid?'me':''}"><td><div class="pname">${h(t.name)}</div><div class="psub">@${h(t.handle)}</div></td><td class="r num">${t.w}-${t.l}${t.t?'-'+t.t:''}</td><td class="r num">${f1(s.wins)}</td><td class="r num">${pc(s.po)}</td><td class="r num">${pc(s.bye)}</td><td class="r num">${pc(s.one)}</td><td class="r num">${pc(s.champ)}</td><td class="r num">${pc(s.last)}</td><td class="r num">${pc(s.toilet)}</td></tr>`}).join('')}
  </tbody></table></div>
  <div class="row" style="margin-top:10px"><button class="btn ghost" id="btnSim">Rerun 6,000 simulations</button></div>`;
}
function oppOfWeek(w,rid){const p=pairsOf(S.mu[w]).find(x=>x.some(m=>m.roster_id===rid));return p?p.find(m=>m.roster_id!==rid).roster_id:null}
registerModule({key:'forecast',label:'Forecast',order:40,render:rForecast});
