/* Live: scoreboard, live projections, win probability */
function rLive(){
  const mu=S.mu[S.week]||[],pairs=pairsOf(mu);
  if(!pairs.length)return `<h2>Week ${S.week}</h2><p class="lede">No matchups posted for this week yet.</p>`;
  const side=m=>{const t=S.byRid[m.roster_id],lt=S.liveTeam[m.roster_id]||{mean:0,sd:1,actual:0};return{t,m,lt}};
  const wp=(a,b)=>Phi((a.lt.mean-b.lt.mean)/Math.sqrt(a.lt.sd**2+b.lt.sd**2));
  let mine=pairs.find(p=>p.some(m=>m.roster_id===S.meRid));const rest=pairs.filter(p=>p!==mine);
  let html='';
  if(mine){if(mine[1].roster_id===S.meRid)mine=[mine[1],mine[0]];const A=side(mine[0]),B=side(mine[1]),p=wp(A,B);
    html+=`<section class="board" aria-label="Your matchup">
      <div class="board-grid">
        ${[A,B].map((x,i)=>`<div class="side ${i?'right':''}"><div class="tname">${h(x.t.name)}</div><div class="handle">@${h(x.t.handle)}, ${x.t.w}-${x.t.l}</div>
          <div class="big">${f1(x.lt.mean)}</div><div class="sub">Live projection. ${f1(x.lt.actual)} scored so far</div></div>`).join('')}
      </div>
      <div class="wp"><div class="track"><i style="width:${p*100}%"></i></div><div class="lbl"><span>${pc(p)} to win</span><span>${pc(1-p)}</span></div></div>
    </section>
    <div class="grid2" style="margin-top:16px">${[A,B].map(x=>starterTable(x)).join('')}</div>`}
  html+=`<h2>Around the league</h2><p class="lede">Live projection = points scored + the unplayed share of each starter's projection, based on the real game clock.</p><div class="panel">`;
  html+=rest.map(pr=>{const A=side(pr[0]),B=side(pr[1]),p=wp(A,B);return `<div class="mini">
    <div><div class="pname">${h(A.t.name)}</div><div class="psub">${f1(A.lt.actual)} scored, ${pc(p)} to win</div></div>
    <div class="mid"><span class="sc">${f1(A.lt.mean)}</span> <span class="mute">vs</span> <span class="sc">${f1(B.lt.mean)}</span></div>
    <div class="r"><div class="pname">${h(B.t.name)}</div><div class="psub">${f1(B.lt.actual)} scored, ${pc(1-p)} to win</div></div></div>`}).join('');
  return html+'</div>';
}
function starterTable(x){
  const pp=x.m.players_points||{};const rows=(x.m.starters||[]).map((id,i)=>{const slot=S.slots[i]||'';
    if(!id||id==='0')return `<tr><td>${posTag(slot)}</td><td class="flag">Empty slot</td><td></td><td></td></tr>`;
    const lp=livePlayer(id,pp[id]||0),p=S.P[id]||{},g=S.games[p.team];
    const warn=(p.inj==='Out'||p.inj==='IR'||p.inj==='Sus'||(lp.full===0&&lp.r>0&&!lp.actual))?' <span class="flag">Likely zero</span>':'';
    return `<tr><td>${posTag(slot)}</td><td>${pcell(id)}${warn}<div class="psub">${g?h(g.detail||''):(p.team?'':'No team')}</div></td>
      <td class="r num" style="font-size:18px">${f1(lp.actual)}</td><td class="r num mute">${f1(lp.mean)}</td></tr>`}).join('');
  return `<div class="panel"><h3 style="margin-top:0">${h(x.t.name)}</h3><div class="scroll"><table class="plist"><thead><tr><th>Slot</th><th>Player</th><th class="r">Pts</th><th class="r">Proj</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
registerModule({key:'live',label:'Live',order:10,live:true,render:rLive});
