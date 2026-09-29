/* Live: scoreboard, live projections, win probability, and every player's projection in every matchup */
function liveSide(m){const t=S.byRid[m.roster_id],lt=S.liveTeam[m.roster_id]||{mean:0,sd:1,actual:0};
  const proj0=(m.starters||[]).filter(id=>id&&id!=='0').reduce((s,id)=>s+wk(id),0);return{t,m,lt,proj0}}
const liveWP=(a,b)=>Phi((a.lt.mean-b.lt.mean)/Math.sqrt(a.lt.sd**2+b.lt.sd**2));
function rLive(){
  const mu=S.mu[S.week]||[],pairs=pairsOf(mu);
  if(!pairs.length)return `<h2>Week ${S.week}</h2><p class="lede">No matchups posted for this week yet.</p>`;
  let mine=pairs.find(p=>p.some(m=>m.roster_id===S.meRid));const rest=pairs.filter(p=>p!==mine);
  const over=S.weekOver||Object.values(S.games).length>0&&Object.values(S.games).every(g=>g.state==='post');
  let html=over?`<p class="lede" style="margin-top:4px">Week ${S.week} is final. Pts is what each player scored, Proj is what he was projected before kickoff.${S.planWeek>S.week?` Lineup, Waivers and the Sportsbook have moved on to week ${S.planWeek}.`:''}</p>`:'';
  if(!S.projOK)html+=`<div class="err" style="margin-bottom:14px"><b>Sleeper projections didn't load.</b> Proj shows 0 until they do; reload the page to try again.</div>`;
  if(mine){if(mine[1].roster_id===S.meRid)mine=[mine[1],mine[0]];const A=liveSide(mine[0]),B=liveSide(mine[1]),p=liveWP(A,B);
    html+=`<section class="board" aria-label="Your matchup">
      <div class="board-grid">
        ${[A,B].map((x,i)=>`<div class="side ${i?'right':''}"><div class="tname">${h(x.t.name)}</div><div class="handle">@${h(x.t.handle)}, ${x.t.w}-${x.t.l}</div>
          <div class="big">${f1(over?x.lt.actual:x.lt.mean)}</div><div class="sub">${over?`Final. Projected ${f1(x.proj0)} before kickoff`:`Live projection. ${f1(x.lt.actual)} scored, ${f1(x.proj0)} projected at kickoff`}</div></div>`).join('')}
      </div>
      <div class="wp"><div class="track"><i style="width:${p*100}%"></i></div><div class="lbl"><span>${over?(A.lt.actual>B.lt.actual?'Won':A.lt.actual<B.lt.actual?'Lost':'Tied'):pc(p)+' to win'}</span><span>${over?'':pc(1-p)}</span></div></div>
    </section>
    <div class="grid2" style="margin-top:16px">${[A,B].map(x=>starterTable(x)).join('')}</div>`}
  html+=`<h2>Around the league</h2><p class="lede">Live projection is points scored plus the unplayed share of each starter's projection, based on the real game clock. Open any matchup to see every player.</p>`;
  html+=rest.map(pr=>{const A=liveSide(pr[0]),B=liveSide(pr[1]),p=liveWP(A,B);return `<details class="panel lv-mu">
    <summary><div class="mini">
      <div><div class="pname">${h(A.t.name)}</div><div class="psub">${over?`proj ${f1(A.proj0)}`:`${f1(A.lt.actual)} scored, ${pc(p)} to win`}</div></div>
      <div class="mid"><span class="sc">${f1(over?A.lt.actual:A.lt.mean)}</span> <span class="mute">vs</span> <span class="sc">${f1(over?B.lt.actual:B.lt.mean)}</span></div>
      <div class="r"><div class="pname">${h(B.t.name)}</div><div class="psub">${over?`proj ${f1(B.proj0)}`:`${f1(B.lt.actual)} scored, ${pc(1-p)} to win`}</div></div></div></summary>
    <div class="grid2" style="margin-top:10px">${[A,B].map(x=>starterTable(x,true)).join('')}</div></details>`}).join('');
  return html;
}
function starterTable(x,bare){
  const pp=x.m.players_points||{};const rows=(x.m.starters||[]).map((id,i)=>{const slot=S.slots[i]||'';
    if(!id||id==='0')return `<tr><td>${posTag(slot)}</td><td class="flag">Empty slot</td><td></td><td></td><td></td></tr>`;
    const lp=livePlayer(id,pp[id]||0),p=S.P[id]||{},g=S.games[p.team];
    const warn=!S.weekOver&&(p.inj==='Out'||p.inj==='IR'||p.inj==='Sus'||(lp.full===0&&lp.r>0&&!lp.actual))?' <span class="flag">Likely zero</span>':'';
    const beat=lp.r===0&&lp.full>0?(lp.actual>=lp.full?'up':'down'):'';
    return `<tr><td>${posTag(slot)}</td><td>${pcell(id)}${warn}<div class="psub">${S.weekOver?'Final':g?h(g.detail||''):(p.team?'Bye':'No team')}</div></td>
      <td class="r num ${beat}" style="font-size:18px">${f1(lp.actual)}</td><td class="r num mute">${f1(lp.full)}</td><td class="r num">${lp.r>0?f1(lp.mean):'<span class="mute">Final</span>'}</td></tr>`}).join('');
  const bench=(x.m.players||[]).filter(id=>S.P[id]&&!(x.m.starters||[]).includes(id)).map(id=>({id,p:pp[id]||0})).sort((a,b)=>b.p-a.p);
  const tbl=`<div class="scroll"><table class="plist"><thead><tr><th>Slot</th><th>Player</th><th class="r">Pts</th><th class="r">Proj</th><th class="r">Live</th></tr></thead><tbody>${rows}
    <tr><td></td><td class="pname">Total</td><td class="r num" style="font-size:18px">${f1(x.lt.actual)}</td><td class="r num mute">${f1(x.proj0)}</td><td class="r num">${f1(x.lt.mean)}</td></tr></tbody></table></div>
    ${bench.some(b=>b.p>0)?`<p class="psub" style="margin:8px 0 0">Bench: ${bench.filter(b=>b.p>0).slice(0,5).map(b=>`${h(S.P[b.id].n)} ${f1(b.p)}`).join(', ')}</p>`:''}`;
  return bare?`<div><h3 style="margin-top:0">${h(x.t.name)}</h3>${tbl}</div>`:`<div class="panel"><h3 style="margin-top:0">${h(x.t.name)}</h3>${tbl}</div>`;
}
registerModule({key:'live',label:'Live',order:10,live:true,render:rLive});
