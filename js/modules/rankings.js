/* Rankings: season power rankings and dynasty power rankings */
function rRank(){
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
registerModule({key:'rank',label:'Rankings',order:30,render:rRank});
