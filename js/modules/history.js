/* History: every season this league has on Sleeper, followed back through previous_league_id.
   All-time manager records, trophies, league records, the best players in league history, and a trade ledger that grades
   every trade by the points the players actually scored for their new team plus what the assets are worth today.
   Completed seasons are cached in the browser; the current season is always fetched fresh. */
const HX={sec:'all',state:'idle',err:null,data:null,leagueId:null};
async function histSeason(lg){
  const id=lg.league_id,complete=lg.status==='complete';
  if(complete){const c=await idbGet('hist_v1_'+id);if(c)return c}
  const pws=(lg.settings&&lg.settings.playoff_week_start)||15,last=Math.min(18,pws+3);
  const [users,rosters,wb,lb,drafts,mus,txs]=await Promise.all([
    tj(`${API}/v1/league/${id}/users`),tj(`${API}/v1/league/${id}/rosters`),tj(`${API}/v1/league/${id}/winners_bracket`),tj(`${API}/v1/league/${id}/losers_bracket`),tj(`${API}/v1/league/${id}/drafts`),
    Promise.all(range(1,last).map(w=>tj(`${API}/v1/league/${id}/matchups/${w}`))),
    Promise.all(range(0,last).map(w=>tj(`${API}/v1/league/${id}/transactions/${w}`)))]);
  const U={};(users||[]).forEach(u=>U[u.user_id]={name:u.display_name,team:(u.metadata&&u.metadata.team_name)||u.display_name,avatar:u.avatar});
  const owner={};(rosters||[]).forEach(r=>owner[r.roster_id]=r.owner_id||null);
  const weeks={},muRaw={};
  mus.forEach((mu,i)=>{const w=i+1;if(!mu||!mu.some(m=>m.points>0))return;muRaw[w]=mu.map(m=>({roster_id:m.roster_id,points:m.points||0}));
    weeks[w]=mu.map(m=>{const sp={};(m.starters||[]).forEach(pid=>{if(pid&&pid!=='0')sp[pid]=(m.players_points||{})[pid]||0});return{rid:m.roster_id,uid:owner[m.roster_id],mid:m.matchup_id,pts:m.points||0,sp}})});
  const trades=[];(txs||[]).forEach(list=>(list||[]).forEach(t=>{if(t.type!=='trade'||t.status!=='complete')return;
    trades.push({id:t.transaction_id,week:t.leg||0,ts:t.status_updated||t.created,rids:t.roster_ids||[],adds:t.adds||{},drops:t.drops||{},picks:(t.draft_picks||[]).map(p=>({season:Number(p.season),round:p.round,orig:p.roster_id,from:p.previous_owner_id,to:p.owner_id}))})}));
  // draft results, so a traded pick can be followed to the player it became
  const draft={};
  for(const d of (drafts||[]).filter(d=>d.status==='complete')){
    const [info,picks]=await Promise.all([tj(`${API}/v1/draft/${d.draft_id}`),tj(`${API}/v1/draft/${d.draft_id}/picks`)]);
    const slot=(info&&info.slot_to_roster_id)||{};
    (picks||[]).forEach(p=>{const orig=slot[p.draft_slot]||p.roster_id;draft[`${d.season||lg.season}-${p.round}-${orig}`]={pid:p.player_id,by:p.roster_id}})}
  const br=bracketResult(wb||[],lb||[],muRaw,pws);
  const H={id,season:Number(lg.season),name:lg.name,complete,pws,nPO:(lg.settings&&lg.settings.playoff_teams)||6,users:U,owner,weeks,trades,draft,br,
    poTeams:[...new Set((wb||[]).flatMap(m=>[m.t1,m.t2]).filter(x=>typeof x==='number'))]};
  if(complete)idbSet('hist_v1_'+id,H);
  return H;
}
async function loadHistory(){
  HX.state='loading';HX.err=null;HX.leagueId=S.leagueId;
  try{
    const chain=[];let lg=S.league;const seen=new Set();
    while(lg&&!seen.has(lg.league_id)&&chain.length<12){seen.add(lg.league_id);chain.push(lg);const prev=lg.previous_league_id;if(!prev||prev==='0')break;lg=await tj(`${API}/v1/league/${prev}`)}
    const seasons=[];for(const l of chain)seasons.push(await histSeason(l));
    seasons.sort((a,b)=>a.season-b.season);
    HX.data=histCompute(seasons);HX.state='ready';
  }catch(e){console.error(e);HX.state='error';HX.err=e.message||String(e)}
  if(S.tab==='history')render();
}

/* ---------- the numbers ---------- */
function histCompute(seasons){
  const M={};const who=uid=>M[uid]||(M[uid]={uid,name:'Unknown',team:'',seasons:0,w:0,l:0,t:0,pf:0,pa:0,games:0,po:0,titles:[],runner:[],third:[],toilet:[],best:null,trades:0,tProd:0,tVal:0,tScore:0,hiWeek:null});
  // latest names win
  for(const H of seasons)for(const uid in H.users){const m=who(uid);m.name=H.users[uid].name;m.team=H.users[uid].team}
  const recs={hiWeek:null,loWeek:null,blow:null,close:null};const players={};const seasonRows=[];
  for(const H of seasons){
    const st={};const ownerUid=r=>H.owner[r];
    Object.keys(H.owner).forEach(r=>{if(H.owner[r])st[r]={rid:Number(r),uid:H.owner[r],w:0,l:0,t:0,pf:0,pa:0,hi:0}});
    for(const [w,list] of Object.entries(H.weeks)){const wk=Number(w);
      const byMid={};list.forEach(x=>{if(x.mid!=null)(byMid[x.mid]=byMid[x.mid]||[]).push(x)});
      for(const x of list){for(const [pid,v] of Object.entries(x.sp)){const p=players[pid]||(players[pid]={pid,pts:0,games:0,by:{}});p.pts+=v;p.games++;p.by[x.uid]=(p.by[x.uid]||0)+v}}
      for(const pair of Object.values(byMid)){if(pair.length!==2)continue;const [a,b]=pair;
        for(const [x,y] of [[a,b],[b,a]]){const s=st[x.rid];if(!s)continue;
          if(!x.pts&&!y.pts)continue;
          const rec={pts:x.pts,uid:x.uid,season:H.season,week:wk,opp:y.uid};
          if(!recs.hiWeek||x.pts>recs.hiWeek.pts)recs.hiWeek=rec;
          if(wk<H.pws&&x.pts>0&&(!recs.loWeek||x.pts<recs.loWeek.pts))recs.loWeek=rec;
          const m=who(x.uid);if(!m.hiWeek||x.pts>m.hiWeek.pts)m.hiWeek=rec;
          if(wk>=H.pws)continue; // records below are regular season only
          s.pf+=x.pts;s.pa+=y.pts;if(x.pts>y.pts)s.w++;else if(x.pts<y.pts)s.l++;else s.t++;}
        if(wk<H.pws&&(a.pts||b.pts)){const W=a.pts>=b.pts?a:b,L=W===a?b:a,mg=W.pts-L.pts;const g={w:W.uid,l:L.uid,wp:W.pts,lp:L.pts,m:mg,season:H.season,week:wk};
          if(!recs.blow||mg>recs.blow.m)recs.blow=g;if(mg>0&&(!recs.close||mg<recs.close.m))recs.close=g}}
    }
    const rows=Object.values(st).filter(s=>s.w+s.l+s.t>0).sort((x,y)=>y.w-x.w||y.pf-x.pf);
    rows.forEach((s,i)=>{s.seed=i+1;s.po=H.poTeams.includes(s.rid);s.gp=s.w+s.l+s.t;
      const m=who(s.uid);m.seasons++;m.w+=s.w;m.l+=s.l;m.t+=s.t;m.pf+=s.pf;m.pa+=s.pa;m.games+=s.gp;if(s.po)m.po++;
      const wp=(s.w+s.t/2)/s.gp;if(!m.best||wp>m.best.wp||(wp===m.best.wp&&s.pf/s.gp>m.best.ppg))m.best={season:H.season,w:s.w,l:s.l,t:s.t,wp,ppg:s.pf/s.gp}});
    const br=H.br,u=r=>r!=null?ownerUid(r):null;
    if(H.complete){if(u(br.champ))who(u(br.champ)).titles.push(H.season);if(u(br.runner))who(u(br.runner)).runner.push(H.season);if(u(br.third))who(u(br.third)).third.push(H.season);if(u(br.toilet))who(u(br.toilet)).toilet.push(H.season)}
    seasonRows.push({H,rows,champ:u(br.champ),runner:u(br.runner),third:u(br.third),toilet:u(br.toilet),last:rows.length?rows[rows.length-1].uid:null});
  }
  const trades=gradeTrades(seasons,who);
  // best and worst single seasons
  const allSeasons=seasonRows.flatMap(x=>x.rows.map(r=>({...r,season:x.H.season,complete:x.H.complete,champ:x.champ===r.uid})));
  const done=allSeasons.filter(r=>r.complete);
  const byWp=[...done].sort((a,b)=>(b.w+b.t/2)/b.gp-(a.w+a.t/2)/a.gp||b.pf/b.gp-a.pf/a.gp);
  const byPf=[...done].sort((a,b)=>b.pf/b.gp-a.pf/a.gp);
  const topPlayers=Object.values(players).filter(p=>S.P[p.pid]).sort((a,b)=>b.pts-a.pts).slice(0,15);
  const mvps=seasonRows.map(x=>{const pts={};for(const list of Object.values(x.H.weeks))for(const e of list)for(const [pid,v] of Object.entries(e.sp)){if(!pts[pid])pts[pid]={v:0,by:{}};pts[pid].v+=v;pts[pid].by[e.uid]=(pts[pid].by[e.uid]||0)+v}
    const best=Object.entries(pts).filter(([pid])=>S.P[pid]).sort((a,b)=>b[1].v-a[1].v)[0];return best?{season:x.H.season,pid:best[0],pts:best[1].v,uid:Object.entries(best[1].by).sort((a,b)=>b[1]-a[1])[0][0]}:null});
  return{seasons:seasonRows,managers:Object.values(M).filter(m=>m.seasons>0),recs,topPlayers,mvps,trades,best:byWp[0],worst:byWp[byWp.length-1],bestPf:byPf[0],
    completeCount:seasonRows.filter(x=>x.H.complete).length};
}
/* production after a trade: points a player scored in the starting lineup of a team owned by uid, from the week after the trade on */
function gradeTrades(seasons,who){
  const idx=seasons.map(H=>({s:H.season,weeks:Object.entries(H.weeks).map(([w,l])=>({w:Number(w),list:l}))}));
  const prod=(pid,uid,s0,w0)=>{let t=0;for(const x of idx){if(x.s<s0)continue;for(const k of x.weeks){if(x.s===s0&&k.w<=w0)continue;for(const e of k.list)if(e.uid===uid&&e.sp[pid]!=null)t+=e.sp[pid]}}return t};
  const draftOf=(season,round,orig)=>{for(const H of seasons){const d=H.draft[`${season}-${round}-${orig}`];if(d)return d}return null};
  const futurePick=(season,round,orig)=>{const k=(S.picks||[]).find(p=>p.season===season&&p.round===round&&p.orig===orig);return k?pickValue(k):0};
  const out=[];
  for(const H of seasons)for(const t of H.trades){
    const uidOf=r=>H.owner[r];const items=[];
    for(const [pid,to] of Object.entries(t.adds)){const from=t.drops[pid];items.push({kind:'p',pid,from,to})}
    for(const p of t.picks)items.push({kind:'k',...p,from:p.from,to:p.to});
    for(const it of items){const toU=uidOf(it.to);
      if(it.kind==='p'){it.label=S.P[it.pid]?S.P[it.pid].n:'Unknown player';it.prod=prod(it.pid,toU,H.season,t.week);it.val=S.val[it.pid]||0}
      else{const d=draftOf(it.season,it.round,it.orig);const oName=(H.users[uidOf(it.orig)]||{}).team||'';
        it.label=`${it.season} round ${it.round}${oName?` (${oName})`:''}`;
        if(d){it.became=d.pid;it.label+=` → ${S.P[d.pid]?S.P[d.pid].n:'player'}`;it.prod=prod(d.pid,uidOf(d.by),it.season,0)*(uidOf(d.by)===toU?1:0);it.val=S.val[d.pid]||0}
        else{it.prod=0;it.val=futurePick(it.season,it.round,it.orig)}}}
    const sides=t.rids.map(r=>{const uid=uidOf(r);const inn=items.filter(i=>i.to===r),out_=items.filter(i=>i.from===r);
      const s={uid,rid:r,inn,out:out_,prodIn:inn.reduce((a,i)=>a+i.prod,0),prodOut:out_.reduce((a,i)=>a+i.prod,0),valIn:inn.reduce((a,i)=>a+i.val,0),valOut:out_.reduce((a,i)=>a+i.val,0)};
      s.prodNet=s.prodIn-s.prodOut;s.valNet=s.valIn-s.valOut;s.score=s.prodNet+s.valNet/50;return s});
    if(sides.length<2||!items.length)continue;
    const win=[...sides].sort((a,b)=>b.score-a.score)[0];const margin=win.score-[...sides].sort((a,b)=>b.score-a.score)[1].score;
    sides.forEach(s=>{const m=who(s.uid);m.trades++;m.tProd+=s.prodNet;m.tVal+=s.valNet;m.tScore+=s.score});
    out.push({season:H.season,week:t.week,ts:t.ts,sides,winner:margin>15?win.uid:null,margin});
  }
  return out.sort((a,b)=>b.season-a.season||b.week-a.week);
}

/* ---------- view ---------- */
const hName=uid=>{const m=HX.data&&HX.data.managers.find(x=>x.uid===uid);return m?m.team||m.name:'Unknown'};
const hWho=uid=>{const m=HX.data&&HX.data.managers.find(x=>x.uid===uid);return m?`<span class="pname">${h(m.team||m.name)}</span> <span class="psub">@${h(m.name)}</span>`:'Unknown'};
const rec=(w,l,t)=>`${w}-${l}${t?'-'+t:''}`;
function rHistory(){
  if(HX.leagueId!==S.leagueId&&HX.state!=='loading'){HX.state='idle';HX.data=null}
  if(HX.state==='idle'){setTimeout(loadHistory,0);HX.state='loading'}
  if(HX.state==='loading')return `<h2>History</h2><div class="status">Following this league back through every season on Sleeper. The first visit reads a lot of box scores, so give it a few seconds; finished seasons are saved on this device after that.</div>`;
  if(HX.state==='error')return `<h2>History</h2><div class="err"><b>History couldn't load.</b><p style="margin:6px 0 0">${h(HX.err)}</p></div>`;
  const D=HX.data;const yrs=D.seasons.map(x=>x.H.season).sort((a,b)=>b-a);
  const secs=[['all','All time'],['trades','Trades'],...yrs.map(y=>[String(y),String(y)+(D.seasons.find(x=>x.H.season===y).H.complete?'':' (live)')])];
  const nav=`<nav class="chips" style="margin:6px 0 16px" aria-label="History sections">${secs.map(([k,l])=>`<button class="chip" data-hx="${k}" aria-pressed="${HX.sec===k}">${l}</button>`).join('')}</nav>`;
  const body=needsPro('history')&&HX.sec!=='all'?proCard('history'):HX.sec==='all'?hxAll(D):HX.sec==='trades'?hxTrades(D):hxSeason(D,Number(HX.sec));
  return `<h2>History</h2><p class="lede">${D.seasons.length} ${D.seasons.length===1?'season':'seasons'} of ${h(S.league.name)} on Sleeper${D.completeCount?`, ${D.completeCount} finished`:''}. Records count regular-season games; titles and toilet bowls come from the playoff brackets.</p>${nav}${body}`;
}
function hxAll(D){
  const Ms=[...D.managers].sort((a,b)=>b.titles.length-a.titles.length||(b.w+b.t/2)/Math.max(1,b.games)-(a.w+a.t/2)/Math.max(1,a.games));
  const trophies=D.seasons.filter(x=>x.H.complete).sort((a,b)=>b.H.season-a.H.season);
  const card=(title,body)=>`<div class="panel hx-rec"><div class="psub">${title}</div>${body}</div>`;
  const R=D.recs,best=D.best,worst=D.worst,bp=D.bestPf;
  const traders=[...D.managers].filter(m=>m.trades).sort((a,b)=>b.tScore-a.tScore);
  return `${trophies.length?`<h3>Trophy case</h3><div class="hx-trophies">${trophies.map(x=>`<div class="panel hx-tro"><div class="num hx-yr">${x.H.season}</div>
      <div><span class="psub">Champion</span><div>${x.champ?hWho(x.champ):'n/a'}</div></div>
      <div><span class="psub">Runner-up</span><div>${x.runner?h(hName(x.runner)):'n/a'}</div></div>
      <div><span class="psub">Toilet bowl</span><div>${x.toilet?h(hName(x.toilet)):'n/a'}</div></div></div>`).join('')}</div>`:`<div class="panel">No finished seasons yet. Champions and toilet bowls show up here once a season ends; everything below counts this season so far.</div>`}
  ${needsPro('history')?proCard('history'):`<h3>League records</h3><div class="hx-recs">
    ${best?card('Best team ever',`<div>${hWho(best.uid)}</div><div class="num hx-big">${rec(best.w,best.l,best.t)}</div><div class="psub">${best.season}, ${f1(best.pf/best.gp)} pts a week${best.champ?', won the title':''}</div>`):''}
    ${bp&&bp!==best?card('Most points in a season',`<div>${hWho(bp.uid)}</div><div class="num hx-big">${f1(bp.pf)}</div><div class="psub">${bp.season}, ${f1(bp.pf/bp.gp)} a week</div>`):''}
    ${R.hiWeek?card('Highest score in a week',`<div>${hWho(R.hiWeek.uid)}</div><div class="num hx-big">${f1(R.hiWeek.pts)}</div><div class="psub">${R.hiWeek.season}, week ${R.hiWeek.week}</div>`):''}
    ${R.loWeek?card('Lowest score in a week',`<div>${hWho(R.loWeek.uid)}</div><div class="num hx-big">${f1(R.loWeek.pts)}</div><div class="psub">${R.loWeek.season}, week ${R.loWeek.week}</div>`):''}
    ${R.blow?card('Biggest blowout',`<div>${h(hName(R.blow.w))} over ${h(hName(R.blow.l))}</div><div class="num hx-big">${f1(R.blow.wp)} to ${f1(R.blow.lp)}</div><div class="psub">${R.blow.season}, week ${R.blow.week}, by ${f1(R.blow.m)}</div>`):''}
    ${R.close?card('Closest game',`<div>${h(hName(R.close.w))} over ${h(hName(R.close.l))}</div><div class="num hx-big">${f1(R.close.wp)} to ${f1(R.close.lp)}</div><div class="psub">${R.close.season}, week ${R.close.week}, by ${R.close.m.toFixed(2)}</div>`):''}
    ${worst&&worst!==best?card('Worst team ever',`<div>${hWho(worst.uid)}</div><div class="num hx-big">${rec(worst.w,worst.l,worst.t)}</div><div class="psub">${worst.season}, ${f1(worst.pf/worst.gp)} pts a week</div>`):''}
    ${traders.length?card('Best trader',`<div>${hWho(traders[0].uid)}</div><div class="num hx-big">${traders[0].tProd>=0?'+':''}${f0(traders[0].tProd)} pts</div><div class="psub">won in production across ${traders[0].trades} ${traders[0].trades===1?'trade':'trades'}</div>`):''}
  </div>
  <h3>All-time standings</h3><div class="panel scroll"><table><thead><tr><th>Manager</th><th class="r">Seasons</th><th class="r">Record</th><th class="r">Win %</th><th class="r">Points for</th><th class="r">Per week</th><th class="r">Playoffs</th><th class="r">Titles</th><th class="r">Runner-up</th><th class="r">Toilet bowls</th><th>Best season</th></tr></thead><tbody>
  ${Ms.map(m=>`<tr class="${m.uid===(S.byRid[S.meRid]||{}).uid&&S.inLeague?'me':''}"><td>${hWho(m.uid)}</td><td class="r num">${m.seasons}</td><td class="r num">${rec(m.w,m.l,m.t)}</td><td class="r num">${pc((m.w+m.t/2)/Math.max(1,m.games))}</td><td class="r num">${f0(m.pf)}</td><td class="r num">${f1(m.pf/Math.max(1,m.games))}</td><td class="r num">${m.po}</td>
    <td class="r num">${m.titles.length?`${m.titles.length} <span class="psub">(${m.titles.join(', ')})</span>`:'0'}</td><td class="r num">${m.runner.length}</td><td class="r num">${m.toilet.length}</td><td class="psub">${m.best?`${m.best.season}, ${rec(m.best.w,m.best.l,m.best.t)}`:''}</td></tr>`).join('')}</tbody></table></div>
  <div class="grid2" style="margin-top:16px">
   <div class="panel"><h3 style="margin-top:0">Best players in league history</h3><p class="psub" style="margin:-4px 0 8px">Points scored from starting lineups, all teams, all seasons.</p>
    <div class="scroll"><table><tbody>${D.topPlayers.map((p,i)=>{const top=Object.entries(p.by).sort((a,b)=>b[1]-a[1])[0];return `<tr><td class="num mute">${i+1}</td><td>${pcell(p.pid)}<div class="psub">Most for ${h(hName(top[0]))}</div></td><td class="r num">${f0(p.pts)}</td><td class="r psub">${p.games} starts</td></tr>`}).join('')}</tbody></table></div></div>
   <div class="panel"><h3 style="margin-top:0">MVP of each season</h3><div class="scroll"><table><tbody>${D.mvps.filter(Boolean).reverse().map(m=>`<tr><td class="num">${m.season}</td><td>${pcell(m.pid)}<div class="psub">for ${h(hName(m.uid))}</div></td><td class="r num">${f0(m.pts)}</td></tr>`).join('')}</tbody></table></div></div>
  </div>`}`;
}
function hxSeason(D,y){
  const X=D.seasons.find(x=>x.H.season===y);if(!X)return '';const H=X.H;const mvp=D.mvps.find(m=>m&&m.season===y);
  const tr=D.trades.filter(t=>t.season===y);
  const finish=uid=>uid===X.champ?'Champion':uid===X.runner?'Runner-up':uid===X.third?'Third':uid===X.toilet?'Toilet bowl':'';
  let hi=null;for(const [w,l] of Object.entries(H.weeks))for(const e of l)if(!hi||e.pts>hi.pts)hi={...e,w};
  return `${H.complete?`<div class="hx-podium">
      <div class="panel hx-p1"><div class="psub">Champion</div><div>${X.champ?hWho(X.champ):'n/a'}</div></div>
      <div class="panel"><div class="psub">Runner-up</div><div>${X.runner?hWho(X.runner):'n/a'}</div></div>
      <div class="panel"><div class="psub">Third place</div><div>${X.third?hWho(X.third):'n/a'}</div></div>
      <div class="panel hx-toilet"><div class="psub">Toilet bowl loser</div><div>${X.toilet?hWho(X.toilet):'n/a'}</div></div></div>`:`<div class="panel" style="margin-bottom:14px">${y} is still being played. Standings are through the latest scored week.</div>`}
  <h3>Regular season</h3><div class="panel scroll"><table><thead><tr><th>#</th><th>Manager</th><th class="r">Record</th><th class="r">Points for</th><th class="r">Points against</th><th>Finish</th></tr></thead><tbody>
  ${X.rows.map(r=>`<tr><td class="num">${r.seed}</td><td>${hWho(r.uid)}</td><td class="r num">${rec(r.w,r.l,r.t)}</td><td class="r num">${f1(r.pf)}</td><td class="r num">${f1(r.pa)}</td><td>${finish(r.uid)?`<span class="tag ${finish(r.uid)==='Toilet bowl'?'bad':'good'}">${finish(r.uid)}</span>`:r.po?'<span class="psub">Playoffs</span>':''}</td></tr>`).join('')}</tbody></table></div>
  <div class="hx-recs" style="margin-top:16px">
   ${mvp?`<div class="panel hx-rec"><div class="psub">Season MVP</div><div class="pname">${h(S.P[mvp.pid].n)}</div><div class="num hx-big">${f0(mvp.pts)}</div><div class="psub">for ${h(hName(mvp.uid))}</div></div>`:''}
   ${hi?`<div class="panel hx-rec"><div class="psub">Top week</div><div>${hWho(hi.uid)}</div><div class="num hx-big">${f1(hi.pts)}</div><div class="psub">week ${hi.w}</div></div>`:''}
   <div class="panel hx-rec"><div class="psub">Trades</div><div class="num hx-big">${tr.length}</div><div class="psub">${tr.length?`most active: ${h(hName(mostActive(tr)))}`:'nobody dealt'}</div></div>
  </div>
  ${tr.length?`<h3>${y} trades</h3>${tradeList(tr)}`:''}`;
}
const mostActive=tr=>{const c={};tr.forEach(t=>t.sides.forEach(s=>c[s.uid]=(c[s.uid]||0)+1));return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0]};
function tradeList(tr){return tr.map(t=>`<div class="panel hx-trade"><div class="psub">${t.season}${t.week?`, week ${t.week}`:', offseason'}${t.winner?`. Winner: <b>${h(hName(t.winner))}</b>`:'. Even so far'}</div>
  <div class="hx-sides">${t.sides.map(s=>`<div class="${t.winner===s.uid?'hx-win':''}"><div class="pname">${h(hName(s.uid))} got</div><ul>${s.inn.map(i=>`<li>${h(i.label)} <span class="psub">${f0(i.prod)} pts for them${i.val?`, worth ${f0(i.val)} now`:''}</span></li>`).join('')||'<li class="psub">Nothing</li>'}</ul>
    <div class="psub">Production <b class="num ${s.prodNet>=0?'up':'down'}">${s.prodNet>=0?'+':''}${f0(s.prodNet)}</b>, value today <b class="num ${s.valNet>=0?'up':'down'}">${s.valNet>=0?'+':''}${f0(s.valNet)}</b></div></div>`).join('')}</div></div>`).join('')}
function hxTrades(D){
  const T=[...D.managers].filter(m=>m.trades).sort((a,b)=>b.tScore-a.tScore);
  if(!D.trades.length)return `<div class="panel">No trades in this league's history yet.</div>`;
  const all=D.trades.flatMap(t=>t.sides.map(s=>({t,s})));const heist=[...all].sort((a,b)=>b.s.score-a.s.score)[0],fleeced=[...all].sort((a,b)=>a.s.score-b.s.score)[0];
  return `<p class="lede">Every trade is graded two ways. Production is the fantasy points the incoming players scored in that manager's starting lineup after the deal, minus what the outgoing players scored for their new teams. Value today is what those assets are worth on the current market (drafted picks count as the player they became). The overall score is production plus value divided by 50.</p>
  <div class="hx-recs">
   <div class="panel hx-rec"><div class="psub">Biggest heist</div><div>${hWho(heist.s.uid)}</div><div class="num hx-big">${heist.s.prodNet>=0?'+':''}${f0(heist.s.prodNet)} pts</div><div class="psub">${heist.t.season}: got ${h(heist.s.inn.map(i=>i.label).join(', '))}</div></div>
   <div class="panel hx-rec"><div class="psub">Most fleeced</div><div>${hWho(fleeced.s.uid)}</div><div class="num hx-big">${fleeced.s.prodNet>=0?'+':''}${f0(fleeced.s.prodNet)} pts</div><div class="psub">${fleeced.t.season}: gave up ${h(fleeced.s.out.map(i=>i.label).join(', '))}</div></div>
  </div>
  <h3>Best traders</h3><div class="panel scroll"><table><thead><tr><th>#</th><th>Manager</th><th class="r">Trades</th><th class="r">Production won</th><th class="r">Value won</th><th class="r">Score</th></tr></thead><tbody>
  ${T.map((m,i)=>`<tr><td class="num">${i+1}</td><td>${hWho(m.uid)}</td><td class="r num">${m.trades}</td><td class="r num ${m.tProd>=0?'up':'down'}">${m.tProd>=0?'+':''}${f0(m.tProd)}</td><td class="r num ${m.tVal>=0?'up':'down'}">${m.tVal>=0?'+':''}${f0(m.tVal)}</td><td class="r num">${m.tScore>=0?'+':''}${f0(m.tScore)}</td></tr>`).join('')}</tbody></table></div>
  <h3>Every trade</h3>${tradeList(D.trades)}`;
}
document.addEventListener('click',e=>{if(S.tab!=='history')return;const b=e.target.closest('[data-hx]');if(b){HX.sec=b.dataset.hx;render()}});
document.addEventListener('wr:reset',()=>{HX.sec='all'});
registerModule({key:'history',label:'History',order:85,render:rHistory});
