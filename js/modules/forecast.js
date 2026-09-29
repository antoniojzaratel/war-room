/* Forecast: this season's odds, team outlooks (contender, win now, rebuilding, tanking...) and the next three seasons */
const FC={sec:store.get('wr_fcsec')||'season',team:null};
function fcBars(key,title,lede,color){
  const sim=S.sim||{};const rows=[...S.teams].map(t=>({t,p:(sim[t.rid]||{})[key]||0})).sort((a,b)=>b.p-a.p);const mx=Math.max(.0001,...rows.map(r=>r.p));
  return `<div class="panel"><h3 style="margin-top:0">${title}</h3><p class="psub" style="margin:-4px 0 10px">${lede}</p>
  ${rows.map((r,i)=>`<div class="fc-row ${r.t.rid===S.meRid?'fc-me':''}" title="${h(r.t.name)}: ${pc(r.p)}"><span class="num fc-rk">${i+1}</span><span class="fc-name">${h(r.t.name)}</span>
    <span class="fc-bar"><i style="width:${r.p/mx*100}%;background:${color}"></i></span><span class="num fc-p">${pc(r.p)}</span></div>`).join('')}</div>`;
}
function oppOfWeek(w,rid){const p=pairsOf(S.mu[w]).find(x=>x.some(m=>m.roster_id===rid));return p?p.find(m=>m.roster_id!==rid).roster_id:null}
const yearLabel=y=>y===0?`${S.season} (rest)`:String(Number(S.season)+y);

/* ---------- this season ---------- */
function fcSeason(){
  const sim=S.sim||{},regLeft=S.week<=S.regEnd,wkQ=S.planWeek;
  let whatIf='';
  if(regLeft&&wkQ<=S.regEnd&&pairsOf(S.mu[wkQ]).some(p=>p.some(m=>m.roster_id===S.meRid))){
    if(!S.whatIf)S.whatIf={win:simulate(2500,{rid:S.meRid,win:true,week:wkQ}),lose:simulate(2500,{rid:S.meRid,win:false,week:wkQ})};
    const W=S.whatIf.win[S.meRid],L=S.whatIf.lose[S.meRid],opp=S.byRid[oppOfWeek(wkQ,S.meRid)];
    const cell=(k,label)=>`<div><div class="psub">${label}</div><div class="num fc-big">${pc(W[k])} <span class="mute">vs</span> ${pc(L[k])}</div></div>`;
    whatIf=`<div class="board fc-board" style="margin-bottom:16px"><div style="position:relative;z-index:1">
      <div class="tname">What week ${wkQ} against ${h(opp?opp.name:'your opponent')} is worth</div>
      <div class="sub" style="margin-bottom:12px">Your odds if you win, versus if you lose.</div>
      <div class="fc-whatif">${cell('po','Make the playoffs')}${cell('bye','First-round bye')}${cell('champ','Win the title')}${cell('toilet','Lose the toilet bowl')}</div></div></div>`;
  }
  const T=[...S.teams].sort((a,b)=>(sim[b.rid].champ-sim[a.rid].champ)||(sim[b.rid].wins-sim[a.rid].wins));
  return `<p class="lede">Every remaining regular-season game on your real schedule, then the playoff bracket and the toilet bowl, simulated thousands of times.</p>
  ${whatIf}
  <div class="grid2">${fcBars('champ','Champion forecast','Chance of winning the title game.','var(--mint)')}
  ${fcBars('toilet','Toilet bowl loser forecast','Chance of missing the playoffs and then losing every consolation game down to the bottom.','var(--red)')}</div>
  <h3>Full odds</h3><div class="panel scroll"><table><thead><tr><th>Team</th><th>Outlook</th><th class="r">Record</th><th class="r">Proj. wins</th><th class="r">Playoffs</th><th class="r">Bye</th><th class="r">#1 seed</th><th class="r">Champion</th><th class="r">Last place</th><th class="r">Toilet bowl</th></tr></thead><tbody>
  ${T.map(t=>{const s=sim[t.rid];return `<tr class="${t.rid===S.meRid?'me':''}"><td><div class="pname">${h(t.name)}</div><div class="psub">@${h(t.handle)}</div></td><td>${olTag(t)}</td><td class="r num">${t.w}-${t.l}${t.t?'-'+t.t:''}</td><td class="r num">${f1(s.wins)}</td><td class="r num">${pc(s.po)}</td><td class="r num">${pc(s.bye)}</td><td class="r num">${pc(s.one)}</td><td class="r num">${pc(s.champ)}</td><td class="r num">${pc(s.last)}</td><td class="r num">${pc(s.toilet)}</td></tr>`}).join('')}
  </tbody></table></div>
  <div class="row" style="margin-top:10px"><button class="btn ghost" id="btnSim">Rerun 6,000 simulations</button></div>`;
}
const olTag=t=>{const o=OUTLOOK[t.outlook]||{};return `<span class="tag ${o.tone==='good'?'good':o.tone==='bad'?'bad':'warn'}">${h(o.label||'')}</span>`};

/* ---------- team outlook ---------- */
function fcOutlook(){
  const T=[...S.teams].sort((a,b)=>(b.rid===S.meRid)-(a.rid===S.meRid)||a.fut[0].rank-b.fut[0].rank);
  const nm=id=>h(S.P[id].n);const n=S.teams.length;
  const counts={};S.teams.forEach(t=>counts[t.outlook]=(counts[t.outlook]||0)+1);
  const legend=Object.keys(OUTLOOK).filter(k=>counts[k]).map(k=>`<div class="ol-leg">${olTag({outlook:k})} <span class="psub">${counts[k]} ${counts[k]===1?'team':'teams'}. ${OUTLOOK[k].line}</span></div>`).join('');
  return `<p class="lede">Each team is placed by how strong its best lineup is now versus two seasons from now, how old its starters are, and the draft picks it owns.</p>
  <div class="panel" style="margin-bottom:16px">${legend}</div>
  <div class="ol-grid">${T.map(t=>{const f=t.fut,d=f[2].rank-f[0].rank;
    const firstsBy={};t.firsts.forEach(p=>(firstsBy[p.season]=firstsBy[p.season]||[]).push(p.orig===t.rid?'own':S.byRid[p.orig].name));
    return `<article class="panel ol-card ${t.rid===S.meRid?'ol-me':''}">
      <div class="ol-head"><div><div class="pname" style="font-size:18px">${h(t.name)}${t.rid===S.meRid?' <span class="tag">You</span>':''}</div><div class="psub">@${h(t.handle)}, ${t.w}-${t.l}</div></div>${olTag(t)}</div>
      <p style="margin:8px 0 12px">${OUTLOOK[t.outlook].line}</p>
      <div class="ol-stats">
        <div><div class="psub">Lineup rank</div><div class="num ol-n">#${f[0].rank} <span class="mute">to</span> #${f[2].rank}</div><div class="psub">now to ${yearLabel(2)}${d<0?', climbing':d>0?', falling':''}</div></div>
        <div><div class="psub">Starter age</div><div class="num ol-n">${t.coreAge?f1(t.coreAge):'n/a'}</div><div class="psub">league avg ${f1(S.teams.reduce((s,x)=>s+(x.coreAge||0),0)/n)}</div></div>
        <div><div class="psub">First-round picks</div><div class="num ol-n">${t.firsts.length}</div><div class="psub">${Object.keys(firstsBy).sort().map(s=>`${s}: ${firstsBy[s].length}`).join(', ')||'none owned'}</div></div>
      </div>
      <ul class="ol-list">
        <li><b>Strongest:</b> ${t.strongPos.p} (${t.strongPos.d>=0?'+':''}${f1(t.strongPos.d)} pts/wk vs league). <b>Weakest:</b> ${t.weakPos.p} (${f1(t.weakPos.d)}).</li>
        ${t.youngCore.length?`<li><b>Young core:</b> ${t.youngCore.slice(0,3).map(id=>`${nm(id)} (${S.P[id].age})`).join(', ')}.</li>`:'<li><b>Young core:</b> none worth building around yet.</li>'}
        ${t.decliners.length?`<li><b>Sell before they drop:</b> ${t.decliners.slice(0,3).map(x=>`${nm(x.id)} (${f1(x.now)} to ${f1(x.y2)} pts/wk)`).join(', ')}.</li>`:''}
        ${t.risers.length?`<li><b>On the rise:</b> ${t.risers.slice(0,3).map(x=>`${nm(x.id)} (${f1(x.now)} to ${f1(x.y2)})`).join(', ')}.</li>`:''}
        ${t.ownNext1&&t.fut[0].rank>n-3?`<li><b>Tank incentive:</b> owns its own ${pickSeasons()[0]} first.</li>`:''}
      </ul>
      <p class="ol-advice"><b>Move:</b> ${h(outlookAdvice(t))}</p>
    </article>`}).join('')}</div>`;
}

/* ---------- next three seasons ---------- */
function slopeChart(){
  const T=S.teams,n=T.length,Y=[0,1,2];
  const W=760,top=28,rowH=34,H=top+rowH*(n-1)+30,xs=[250,380,510];
  const y=r=>top+(r-1)*rowH;
  const lines=T.map(t=>{const me=t.rid===S.meRid;const pts=Y.map(k=>[xs[k],y(t.fut[k].rank)]);
    const tip=`${t.name}: ${Y.map(k=>`${yearLabel(k)} #${t.fut[k].rank} (${f1(t.fut[k].total)} pts/wk)`).join(', ')}`;
    return `<g class="sl-g${me?' sl-me':''}" data-tip="${h(tip)}" tabindex="0">
      <polyline points="${pts.map(p=>p.join(',')).join(' ')}" class="sl-line"/>
      ${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${me?6:4.5}" class="sl-dot"/>`).join('')}
      <text x="${xs[0]-14}" y="${pts[0][1]+5}" text-anchor="end" class="sl-lab">${h(t.name)}</text>
      <text x="${xs[2]+14}" y="${pts[2][1]+5}" class="sl-lab">${h(t.name)}</text>
      <polyline points="${pts.map(p=>p.join(',')).join(' ')}" class="sl-hit"/></g>`}).sort((a,b)=>a.includes('sl-me')-b.includes('sl-me')).join('');
  const axis=Y.map(k=>`<text x="${xs[k]}" y="14" text-anchor="middle" class="sl-yr">${yearLabel(k)}</text><line x1="${xs[k]}" x2="${xs[k]}" y1="${top-8}" y2="${H-18}" class="sl-ax"/>`).join('');
  const ranks=range(1,n).map(r=>`<text x="${W-18}" y="${y(r)+5}" text-anchor="end" class="sl-rk">#${r}</text>`).join('');
  return `<div class="sl-wrap"><svg viewBox="0 0 ${W} ${H}" class="slope" role="img" aria-label="Lineup strength rank for each team, now and the next two seasons. Table below has the numbers.">${axis}${ranks}${lines}</svg><div class="sl-tip" hidden></div></div>`;
}
function fcFuture(){
  const T=[...S.teams].sort((a,b)=>a.fut[2].rank-b.fut[2].rank);
  if(!FC.team)FC.team=S.meRid;const t=S.byRid[FC.team];
  const lu=y=>t.fut[y].lineup.map(x=>`<tr><td>${posTag(x.slot)}</td><td>${x.rk?`<span class="pname">${h(pickLabel(x.pick))}</span><div class="psub">Rookie from this pick, drafted ${x.pick.season}</div>`:`<span class="pname">${h(S.P[x.id].n)}</span><div class="psub">${S.P[x.id].pos}, age ${S.P[x.id].age?S.P[x.id].age+y:'?'} in ${yearLabel(y).slice(0,4)}</div>`}</td><td class="r num">${f1(x.pts)}</td></tr>`).join('');
  return `<p class="lede">Each player is projected forward with a typical aging curve for his position, nudged by his dynasty market value, so a young player priced like a star is read as a breakout in progress. Draft picks turn into expected rookies, scaled by round and by how the original team is likely to finish. Numbers are each team's best lineup, in points per week.</p>
  <div class="panel">${slopeChart()}</div>
  <h3>Strength by season</h3><div class="panel scroll"><table><thead><tr><th>Team</th><th>Outlook</th>${[0,1,2].map(k=>`<th class="r">${yearLabel(k)}</th>`).join('')}<th class="r">Change</th><th class="r">Rookies starting in ${yearLabel(2)}</th></tr></thead><tbody>
  ${T.map(x=>{const ch=x.fut[2].total-x.fut[0].total;return `<tr class="${x.rid===S.meRid?'me':''}"><td class="pname">${h(x.name)}</td><td>${olTag(x)}</td>${[0,1,2].map(k=>`<td class="r num">${f1(x.fut[k].total)} <span class="psub">#${x.fut[k].rank}</span></td>`).join('')}
    <td class="r num ${ch>=0?'up':'down'}">${ch>=0?'+':''}${f1(ch)}</td><td class="r num">${x.fut[2].rookies}</td></tr>`}).join('')}</tbody></table></div>
  <h3>Projected lineups</h3><div class="row"><select id="fcTeam" aria-label="Team">${S.teams.map(x=>`<option value="${x.rid}" ${x.rid===t.rid?'selected':''}>${h(x.name)}${x.rid===S.meRid?' (you)':''}</option>`).join('')}</select></div>
  <div class="fc-lu">${[0,1,2].map(y=>`<div class="panel"><h3 style="margin-top:0">${yearLabel(y)}, ${f1(t.fut[y].total)} pts/wk</h3><div class="scroll"><table><tbody>${lu(y)}</tbody></table></div></div>`).join('')}</div>`;
}
const FSECS=[['season','This season'],['outlook','Team outlook'],['future','Next 3 seasons']];
function rForecast(){
  const body=FC.sec==='outlook'&&needsPro('outlook')?()=>proCard('outlook'):FC.sec==='future'&&needsPro('future')?()=>proCard('future'):({season:fcSeason,outlook:fcOutlook,future:fcFuture}[FC.sec]||fcSeason);
  return `<h2>Forecast</h2><nav class="chips" style="margin:6px 0 14px" aria-label="Forecast sections">${FSECS.map(([k,l])=>`<button class="chip" data-fcsec="${k}" aria-pressed="${FC.sec===k}">${l}</button>`).join('')}</nav>${body()}`;
}
document.addEventListener('click',e=>{if(S.tab!=='forecast')return;const b=e.target.closest('[data-fcsec]');if(b){FC.sec=b.dataset.fcsec;store.set('wr_fcsec',FC.sec);render()}});
document.addEventListener('change',e=>{if(e.target.id==='fcTeam'){FC.team=Number(e.target.value);const y=window.scrollY;render();window.scrollTo(0,y)}});
/* slope chart hover and keyboard focus tooltip */
function slTip(g,ev){const w=g.closest('.sl-wrap'),tip=w.querySelector('.sl-tip');w.querySelectorAll('.sl-g').forEach(x=>x.classList.toggle('sl-dim',x!==g));
  tip.textContent=g.dataset.tip;tip.hidden=false;const r=w.getBoundingClientRect();const x=ev&&ev.clientX?ev.clientX-r.left:r.width/2,y=ev&&ev.clientY?ev.clientY-r.top:20;
  tip.style.left=Math.min(Math.max(8,x+12),r.width-tip.offsetWidth-8)+'px';tip.style.top=Math.max(4,y-44)+'px'}
function slClear(w){w.querySelectorAll('.sl-g').forEach(x=>x.classList.remove('sl-dim'));w.querySelector('.sl-tip').hidden=true}
document.addEventListener('mousemove',e=>{const g=e.target.closest&&e.target.closest('.sl-g');if(g)slTip(g,e);else{const w=document.querySelector('.sl-wrap');if(w&&!w.querySelector('.sl-tip').hidden&&!e.target.closest('.sl-wrap'))slClear(w)}});
document.addEventListener('focusin',e=>{const g=e.target.closest&&e.target.closest('.sl-g');if(g)slTip(g,null)});
document.addEventListener('pointerleave',e=>{if(e.target.classList&&e.target.classList.contains('sl-wrap'))slClear(e.target)},true);
registerModule({key:'forecast',label:'Forecast',order:40,render:rForecast});

document.addEventListener('wr:reset',()=>{FC.team=null});
