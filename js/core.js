/* War Room core: config, helpers, Sleeper loading, models. Every module reads the shared state S. */
/* ============ basics ============ */
const DEF_LEAGUE=CONFIG.featuredLeagueId||'', DEF_USER='antoniojzaratel';
const API='https://api.sleeper.app';
const POS=['QB','RB','WR','TE','K','DEF'];
const ELIG={QB:['QB'],RB:['RB'],WR:['WR'],TE:['TE'],K:['K'],DEF:['DEF'],FLEX:['RB','WR','TE'],SUPER_FLEX:['QB','RB','WR','TE'],REC_FLEX:['WR','TE'],WRRB_FLEX:['RB','WR']};
const ORD=['QB','RB','WR','TE','K','DEF','REC_FLEX','WRRB_FLEX','FLEX','SUPER_FLEX'];
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const qs=new URLSearchParams(location.search);
const S={leagueId:qs.get('league')||store.get('wr_league')||'',username:qs.get('user')||store.get('wr_user')||'',myLeagues:null,
  tab:'live',lang:store.get('wr_lang')||'es',P:{},proj:{},ros:{},val:{},mu:{},tx:{},games:{},liveTeam:{},news:[],trend:[],sim:null,
  tc:null,lineupTeam:null,lineupMode:'week',wvPos:'ALL',gzWeek:null,suggest:null,aiPaper:{}};
const $=s=>document.querySelector(s);
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f1=x=>(Math.round((x||0)*10)/10).toFixed(1);
const f0=x=>Math.round(x||0).toLocaleString('en-US');
const pc=x=>{x=x||0;return (x>0&&x<.01)?'<1%':(x>.99&&x<1)?'>99%':Math.round(x*100)+'%'};
const range=(a,b)=>{const r=[];for(let i=a;i<=b;i++)r.push(i);return r};
function Phi(z){const t=1/(1+.2316419*Math.abs(z)),d=.3989423*Math.exp(-z*z/2);const p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p}
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
async function j(u){const r=await fetch(u);if(!r.ok)throw new Error(r.status+' on '+u);return r.json()}
async function tj(u){try{return await j(u)}catch(e){return null}}

/* IndexedDB cache for the big Sleeper players file (Sleeper asks for at most one pull per day) */
function idb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('warroom',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
async function idbGet(k){try{const d=await idb();return await new Promise(res=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})}catch(e){return null}}
async function idbSet(k,v){try{const d=await idb();d.transaction('kv','readwrite').objectStore('kv').put(v,k)}catch(e){}}

/* ============ loading ============ */
async function loadPlayers(){
  const c=await idbGet('players');if(c&&Date.now()-c.t<864e5)return c.d;
  const d=await j(API+'/v1/players/nfl');const s={};
  for(const id in d){const p=d[id];if(!p||!POS.includes(p.position))continue;
    s[id]={n:p.position==='DEF'?`${p.first_name} ${p.last_name}`:(p.full_name||`${p.first_name||''} ${p.last_name||''}`.trim()),
      pos:p.position,team:p.team||null,age:p.age||null,exp:p.years_exp??null,inj:p.injury_status||null,body:p.injury_body_part||null,active:p.active!==false,rank:p.search_rank||99999}}
  idbSet('players',{t:Date.now(),d:s});return s;
}
const projURL=(s,w)=>`${API}/projections/nfl/${s}/${w}?season_type=regular&${POS.map(p=>'position[]='+p).join('&')}`;
function ptsFromStats(st,pos){
  if(!st)return 0;const sc=S.league.scoring_settings||{};
  if(pos==='DEF'||pos==='K'){const f=st.pts_ppr??st.pts_half_ppr??st.pts_std;if(f!=null)return f}
  let t=0;for(const k in sc){const v=st[k];if(typeof v==='number')t+=v*sc[k]}
  if(!t){const r=sc.rec||0;t=r>=1?(st.pts_ppr||0):r>=.5?(st.pts_half_ppr||0):(st.pts_std||0)}
  return Math.round(t*10)/10;
}

async function load(){
  S.P={};S.proj={};S.ros={};S.val={};S.mu={};S.tx={};S.sim=null;S.suggest=null;S.aiPaper={};
  $('#main').innerHTML='<div class="status">Pulling league, rosters, projections and values…</div>';
  document.dispatchEvent(new Event('wr:reset'));
  const L=S.leagueId;
  const [state,league]=await Promise.all([j(API+'/v1/state/nfl'),j(`${API}/v1/league/${L}`)]);
  if(!league)throw new Error('League not found. Check the league ID.');
  S.state=state;S.league=league;S.season=league.season;
  const [users,rosters,picks,P]=await Promise.all([j(`${API}/v1/league/${L}/users`),j(`${API}/v1/league/${L}/rosters`),tj(`${API}/v1/league/${L}/traded_picks`),loadPlayers()]);
  S.P=P;S.users=users;S.rosters=rosters;S.traded=picks||[];
  S.isDynasty=(league.settings&&league.settings.type)===2;
  S.slots=(league.roster_positions||[]).filter(s=>ELIG[s]);
  S.slotsSorted=[...S.slots].sort((a,b)=>ORD.indexOf(a)-ORD.indexOf(b));
  S.regEnd=Math.max(1,(league.settings.playoff_week_start||15)-1);
  const sameSeason=String(state.season)===String(league.season);
  let wk=1;
  if(sameSeason){if(state.season_type==='regular')wk=state.week||state.display_week||1;else if(state.season_type==='post')wk=18}
  else if(Number(state.season)>Number(league.season))wk=18;
  S.week=Math.min(Math.max(wk,1),18);
  S.gzWeek=null;

  // who am I
  let me=users.find(u=>(u.display_name||'').toLowerCase()===S.username.toLowerCase());
  if(!me){const u=await tj(`${API}/v1/user/${encodeURIComponent(S.username)}`);if(u)me=users.find(x=>x.user_id===u.user_id)}
  S.teams=rosters.map(r=>{const u=users.find(x=>x.user_id===r.owner_id)||{};const st=r.settings||{};
    return{rid:r.roster_id,uid:r.owner_id,name:(u.metadata&&u.metadata.team_name)||u.display_name||('Team '+r.roster_id),handle:u.display_name||'orphan',
      players:(r.players||[]).filter(id=>P[id]),starters:r.starters||[],reserve:new Set(r.reserve||[]),taxi:new Set(r.taxi||[]),
      w:st.wins||0,l:st.losses||0,t:st.ties||0,pf:(st.fpts||0)+(st.fpts_decimal||0)/100,pa:(st.fpts_against||0)+(st.fpts_against_decimal||0)/100}});
  S.byRid={};S.teams.forEach(t=>S.byRid[t.rid]=t);
  S.meRid=me?(S.teams.find(t=>t.uid===me.user_id)||{}).rid:null;
  S.inLeague=S.meRid!=null;
  if(S.meRid==null)S.meRid=S.teams[0].rid;
  S.lineupTeam=S.meRid;S.tc={teams:[S.meRid,S.teams.find(t=>t.rid!==S.meRid).rid],mv:{}};

  // projections: this week + next three for rest-of-season strength
  const pweeks=range(S.week,Math.min(S.week+3,18));
  const lastMu=Math.max(S.regEnd,S.week);
  const [projs,mus,txs,espn,news,trend]=await Promise.all([
    Promise.all(pweeks.map(w=>tj(projURL(S.season,w)))),
    Promise.all(range(1,lastMu).map(w=>tj(`${API}/v1/league/${L}/matchups/${w}`))),
    Promise.all(range(1,S.week).map(w=>tj(`${API}/v1/league/${L}/transactions/${w}`))),
    tj('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'),
    tj('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50'),
    tj(`${API}/v1/players/nfl/trending/add?lookback_hours=48&limit=60`)]);
  pweeks.forEach((w,i)=>{const m={};(projs[i]||[]).forEach(r=>{const p=P[r.player_id];if(p)m[r.player_id]=ptsFromStats(r.stats,p.pos)});S.proj[w]=m});
  S.projOK=!!(projs[0]&&projs[0].length);
  for(const id in P){let s=0;pweeks.forEach(w=>s+=(S.proj[w][id]||0));S.ros[id]=s/pweeks.length}
  range(1,lastMu).forEach((w,i)=>S.mu[w]=mus[i]||[]);
  range(1,S.week).forEach((w,i)=>S.tx[w]=(txs[i]||[]).filter(t=>t.status==='complete'));
  parseESPN(espn);S.planWeek=Math.min(S.weekOver?S.week+1:S.week,18);S.news=(news&&news.articles)||[];S.trend=trend||[];
  const [wb,lb]=await Promise.all([tj(`${API}/v1/league/${L}/winners_bracket`),tj(`${API}/v1/league/${L}/losers_bracket`)]);
  S.wb=wb||[];S.lb=lb||[];
  await loadValues();
  computeAll();
  renderChrome();render();
  startLiveLoop();
}
function parseESPN(d){
  S.games={};S.espnOK=!!d;S.weekOver=false;if(!d||!d.events)return;
  // On Tuesdays ESPN already shows next week's games. Those clocks say nothing about the Sleeper week, so ignore them.
  const ew=d.week&&d.week.number,et=d.season&&d.season.type;
  if(ew&&et===2&&S.week&&ew!==S.week){S.weekOver=ew>S.week;return}
  for(const ev of d.events){const c=ev.competitions&&ev.competitions[0];if(!c)continue;const st=ev.status||c.status||{};
    for(const tm of c.competitors||[]){let ab=(tm.team&&tm.team.abbreviation)||'';if(ab==='WSH')ab='WAS';
      S.games[ab]={state:st.type&&st.type.state,period:st.period,clock:st.clock,detail:st.type&&st.type.shortDetail}}}
}
async function loadValues(){
  const L=S.league,sf=S.slots.includes('SUPER_FLEX'),ppr=(L.scoring_settings&&L.scoring_settings.rec)??1;
  const d=await tj(`https://api.fantasycalc.com/values/current?isDynasty=${S.isDynasty}&numQbs=${sf?2:1}&numTeams=${L.total_rosters||S.teams.length}&ppr=${ppr}`);
  let n=0;if(Array.isArray(d))for(const r of d){const id=r.player&&r.player.sleeperId;if(id&&S.P[id]){S.val[id]=r.value;n++}}
  S.valueSource=n>50?'FantasyCalc market values':'War Room model values';
  for(const id in S.P){if(S.val[id]==null){const m=modelValue(id);if(m>0)S.val[id]=n>50?Math.round(m*.6):m}}
}
function modelValue(id){
  const p=S.P[id];if(!p||!p.team)return 0;if(p.pos==='K'||p.pos==='DEF')return 40;
  const ppg=Math.min(S.ros[id]||0,27);if(ppg<=0)return 0;
  let ageF=1;
  if(S.isDynasty&&p.age){const end={QB:34,RB:26,WR:28,TE:29}[p.pos]||28;const drop={QB:.14,RB:.22,WR:.16,TE:.16}[p.pos]||.16;
    ageF=p.age<=end?Math.min(1.3,1+(end-p.age)*.04):Math.max(.12,1-(p.age-end)*drop)}
  const sf=S.slots.includes('SUPER_FLEX');const posF={QB:sf?1.25:.55,RB:1,WR:1,TE:.9}[p.pos]||1;
  return Math.round(9500*Math.pow(ppg/27,1.7)*ageF*posF);
}

/* ============ core models ============ */
function startable(t,list){const L=list||t.players;return L.filter(id=>S.P[id]&&!(t&&t.reserve.has(id))&&!(t&&t.taxi.has(id)))}
function optimize(pids,fn){
  const pool=pids.filter(id=>S.P[id]).map(id=>({id,pos:S.P[id].pos,pts:fn(id)})).sort((a,b)=>b.pts-a.pts);
  const used=new Set(),lineup=[];let total=0;
  for(const s of S.slotsSorted){const c=pool.find(p=>!used.has(p.id)&&ELIG[s].includes(p.pos));
    if(c){used.add(c.id);lineup.push({slot:s,...c});total+=c.pts}else lineup.push({slot:s,id:null,pos:null,pts:0})}
  return{lineup,total,bench:pool.filter(p=>!used.has(p.id))};
}
const wk=id=>(S.proj[S.week]||{})[id]||0;
/* the week managers are setting lineups for: next week once this one is over */
const wkPlan=id=>(S.proj[S.planWeek]||{})[id]||0;
const ros=id=>S.ros[id]||0;
function isLocked(id){if(S.weekOver)return true;const g=S.games[(S.P[id]||{}).team];return !!g&&(g.state==='in'||g.state==='post')}
function gameFrac(id){if(S.weekOver)return 0;const p=S.P[id];if(!p||!p.team)return 0;const g=S.games[p.team];if(!g)return null;
  if(g.state==='pre')return 1;if(g.state==='post')return 0;const per=g.period||1,clk=g.clock||0;if(per>4)return .02;return Math.max(.02,((4-per)*900+clk)/3600)}
function livePlayer(id,actual){const full=wk(id);let r=gameFrac(id);if(r==null)r=actual>0?.3:1;const rem=full*r;
  return{actual,full,rem,mean:actual+rem,sd:Math.max(1.5,full*.45)*Math.sqrt(r),r}}

function pairsOf(mu){const g={};(mu||[]).forEach(m=>{if(m.matchup_id==null)return;(g[m.matchup_id]=g[m.matchup_id]||[]).push(m)});return Object.values(g).filter(x=>x.length===2)}

function pickSeasons(){const s=Number(S.season);const pre=['pre_draft','drafting'].includes(S.league.status)&&S.league.draft_id;return pre?[s,s+1,s+2]:[s+1,s+2,s+3]}
function computePicks(){
  const rounds=Math.min(S.league.settings.draft_rounds||4,5);const seasons=pickSeasons();const out=[];
  for(const se of seasons)for(let r=1;r<=rounds;r++)for(const t of S.teams){
    const tr=S.traded.find(x=>String(x.season)===String(se)&&x.round===r&&x.roster_id===t.rid);
    out.push({key:`k:${se}-${r}-${t.rid}`,season:se,round:r,orig:t.rid,owner:tr?tr.owner_id:t.rid})}
  S.picks=out;
}
function pickValue(pk){
  const base={1:5200,2:2300,3:1100,4:500,5:250}[pk.round]||200;const yd=pk.season-pickSeasons()[0];
  const rk=(S.dynRankNoPicks||{})[pk.orig]||Math.ceil(S.teams.length/2);const n=S.teams.length;
  let slot=rk<=n/3?.8:rk>2*n/3?1.3:1;slot=1+(slot-1)*Math.pow(.5,yd);
  return Math.round(base*slot*Math.pow(.88,yd));
}
const pickLabel=pk=>{const o=S.byRid[pk.orig];return `${pk.season} round ${pk.round}${pk.owner!==pk.orig?' ('+o.name+')':''}`};
const assetVal=k=>k.startsWith('p:')?(S.val[k.slice(2)]||0):pickValue(S.picks.find(p=>p.key===k));

function computeAll(){
  const T=S.teams;
  T.forEach(t=>{t.rosMean=optimize(startable(t),ros).total;t.wkMean=optimize(startable(t),wk).total});
  // season power: all-play on completed weeks
  const done=range(1,S.week-1).filter(w=>(S.mu[w]||[]).some(m=>m.points>0));S.doneWeeks=done;
  T.forEach(t=>{t.apW=0;t.apG=0;t.hist=[]});
  for(const w of done){const mu=S.mu[w];const pts={};mu.forEach(m=>pts[m.roster_id]=m.points||0);
    T.forEach(t=>{const me=pts[t.rid]||0;T.forEach(o=>{if(o.rid===t.rid)return;t.apG++;if(me>pts[o.rid])t.apW++;else if(me===pts[o.rid])t.apW+=.5});t.hist.push(me)})}
  const rs=T.map(t=>t.rosMean),mn=Math.min(...rs),mx=Math.max(...rs);
  T.forEach(t=>{const rn=mx>mn?(t.rosMean-mn)/(mx-mn):.5;const ap=t.apG?t.apW/t.apG:null;const g=t.w+t.l+t.t;const wp=g?(t.w+t.t*.5)/g:null;
    t.power=ap==null?rn:(.35*ap+.15*wp+.5*rn);t.ap=ap});
  [...T].sort((a,b)=>b.power-a.power).forEach((t,i)=>t.pRank=i+1);
  // dynasty power
  T.forEach(t=>{const lu=optimize(startable(t),ros);const st=new Set(lu.lineup.map(x=>x.id).filter(Boolean));
    t.dStart=[...st].reduce((s,id)=>s+(S.val[id]||0),0);
    t.dBench=t.players.filter(id=>!st.has(id)).map(id=>S.val[id]||0).sort((a,b)=>b-a).slice(0,8).reduce((s,v)=>s+v*.35,0);
    const ages=[...st].map(id=>S.P[id].pos!=='DEF'&&S.P[id].pos!=='K'?S.P[id].age:null).filter(Boolean);t.age=ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:null});
  S.dynRankNoPicks={};[...T].sort((a,b)=>(b.dStart+b.dBench)-(a.dStart+a.dBench)).forEach((t,i)=>S.dynRankNoPicks[t.rid]=i+1);
  computePicks();
  T.forEach(t=>{t.myPicks=S.picks.filter(p=>p.owner===t.rid);t.dPicks=t.myPicks.reduce((s,p)=>s+pickValue(p)*.6,0);t.dTotal=t.dStart+t.dBench+t.dPicks});
  [...T].sort((a,b)=>b.dTotal-a.dTotal).forEach((t,i)=>t.dRank=i+1);
  [...T].sort((a,b)=>b.rosMean-a.rosMean).forEach((t,i)=>t.nowRank=i+1);
  [...T].sort((a,b)=>b.dPicks-a.dPicks).forEach((t,i)=>t.pickRank=i+1);
  const n=T.length;
  T.forEach(t=>{const now=t.nowRank,fut=t.dRank;
    t.tier=now<=3&&fut<=3?'Juggernaut':now<=Math.ceil(n*.4)&&(t.age||0)>=27.5?'Win now, clock ticking':now<=Math.ceil(n*.4)?'Contender':now>n*.6&&t.pickRank<=3?'Smart rebuild':now>n*.6&&fut>n*.6?'Stuck in the mud':fut<now?'Rising':'Middle of the pack'});
  computeLive();
  S.sim=simulate(3000);S.bookM=null;S.whatIf=null;
  computeFuture();
}
function computeLive(){
  S.liveTeam={};const mu=S.mu[S.week]||[];
  mu.forEach(m=>{const st=(m.starters||[]).filter(id=>id&&id!=='0');let mean=0,v=0;
    st.forEach(id=>{const lp=livePlayer(id,(m.players_points||{})[id]||0);mean+=lp.mean;v+=lp.sd*lp.sd});
    S.liveTeam[m.roster_id]={mean,sd:Math.sqrt(v+4),actual:m.points||0}});
}
function simulate(N,force){
  const T=S.teams,idx={};T.forEach((t,i)=>idx[t.rid]=i);
  const mean=T.map(t=>t.rosMean),sd=T.map(t=>Math.max(16,t.rosMean*.17));
  const nPO=Math.min(S.league.settings.playoff_teams||6,T.length);
  const res=T.map(()=>({po:0,bye:0,one:0,champ:0,wins:0,w2:0,toilet:0,last:0}));
  const W0=S.planWeek||S.week;const sched={};for(let w=W0;w<=S.regEnd;w++)sched[w]=pairsOf(S.mu[w]).map(p=>[idx[p[0].roster_id],idx[p[1].roster_id]]);
  // records from the league's own results for every week before the first simulated one
  const base={W:T.map(()=>0),PF:T.map(()=>0)};let seen=0;
  for(let w=1;w<W0;w++)pairsOf(S.mu[w]).forEach(([a,b])=>{if(!(a.points||b.points))return;seen++;const ia=idx[a.roster_id],ib=idx[b.roster_id];
    base.PF[ia]+=a.points||0;base.PF[ib]+=b.points||0;if(a.points>b.points)base.W[ia]++;else if(b.points>a.points)base.W[ib]++;else{base.W[ia]+=.5;base.W[ib]+=.5}});
  if(!seen)T.forEach((t,i)=>{base.W[i]=t.w+t.t*.5;base.PF[i]=t.pf});
  let size=1;while(size<nPO)size*=2;const byes=size-nPO;
  const game=(a,b)=>(mean[a]+sd[a]*gauss())>(mean[b]+sd[b]*gauss())?a:b;
  for(let s=0;s<N;s++){
    const W=base.W.slice(),PF=base.PF.slice();
    for(let w=W0;w<=S.regEnd;w++){for(const [a,b] of sched[w]||[]){let sa,sb;
      const la=S.liveTeam[T[a].rid],lb=S.liveTeam[T[b].rid];
      if(w===S.week&&la&&lb){sa=la.mean+la.sd*gauss();sb=lb.mean+lb.sd*gauss()}else{sa=mean[a]+sd[a]*gauss();sb=mean[b]+sd[b]*gauss()}
      if(force&&w===(force.week||W0)&&(T[a].rid===force.rid||T[b].rid===force.rid)){const fa=T[a].rid===force.rid;if((sa>sb)!==(fa===force.win)){const x=sa;sa=sb;sb=x}}
      PF[a]+=sa;PF[b]+=sb;if(sa>sb)W[a]++;else W[b]++}}
    const order=T.map((_,i)=>i).sort((x,y)=>W[y]-W[x]||PF[y]-PF[x]);
    T.forEach((_,i)=>{res[i].wins+=W[i];res[i].w2+=W[i]*W[i]});res[order[0]].one++;
    const seeds=order.slice(0,nPO);seeds.forEach((i,k)=>{res[i].po++;if(k<byes)res[i].bye++});
    let alive=seeds.slice(0,byes);const play=seeds.slice(byes);
    for(let k=0;k<play.length/2;k++)alive.push(game(play[k],play[play.length-1-k]));
    while(alive.length>1){alive.sort((x,y)=>seeds.indexOf(x)-seeds.indexOf(y));const nx=[];for(let k=0;k<alive.length/2;k++)nx.push(game(alive[k],alive[alive.length-1-k]));alive=nx}
    res[alive[0]].champ++;
    res[order[order.length-1]].last++;
    // toilet bowl: non-playoff teams, loser advances, worst seeds get the byes
    const tb=order.slice(nPO).reverse();
    if(tb.length===1)res[tb[0]].toilet++;
    else if(tb.length>1){let sz=1;while(sz<tb.length)sz*=2;const tby=sz-tb.length;const lose=(a,b)=>game(a,b)===a?b:a;
      let al=tb.slice(0,tby);const pl=tb.slice(tby);for(let k=0;k<pl.length/2;k++)al.push(lose(pl[k],pl[pl.length-1-k]));
      while(al.length>1){al.sort((x,y)=>tb.indexOf(x)-tb.indexOf(y));const nx=[];for(let k=0;k<al.length/2;k++)nx.push(lose(al[k],al[al.length-1-k]));al=nx}
      res[al[0]].toilet++}
  }
  const out={};T.forEach((t,i)=>out[t.rid]={po:res[i].po/N,bye:res[i].bye/N,one:res[i].one/N,champ:res[i].champ/N,wins:res[i].wins/N,winsSd:Math.sqrt(Math.max(0,res[i].w2/N-(res[i].wins/N)**2)),toilet:res[i].toilet/N,last:res[i].last/N});return out;
}


/* shared rendering helpers */
const posTag=p=>`<span class="pos ${p}">${p==='SUPER_FLEX'?'SF':p==='REC_FLEX'?'R/F':p==='WRRB_FLEX'?'W/R':p}</span>`;
function pcell(id){const p=S.P[id];if(!p)return '<span class="mute">Empty</span>';
  const inj=p.inj?` <span class="tag bad">${h(p.inj)}</span>`:'';
  return `<span class="pname">${h(p.n)}</span>${inj}<div class="psub">${p.pos} ${p.team||'FA'}${p.age?', age '+p.age:''}</div>`}

/* module registry: each file in js/modules calls registerModule */
const MODULES=[];
function registerModule(m){MODULES.push(m)}

/* live refresh while NFL games are in progress */
let liveTimer=null;
function startLiveLoop(){clearInterval(liveTimer);liveTimer=setInterval(async()=>{
  if(document.hidden)return;const anyLive=Object.values(S.games).some(g=>g.state==='in');if(!anyLive)return;
  const [mu,espn]=await Promise.all([tj(`${API}/v1/league/${S.leagueId}/matchups/${S.week}`),tj('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard')]);
  if(mu)S.mu[S.week]=mu;if(espn)parseESPN(espn);computeLive();S.sim=simulate(2000);S.bookM=null;S.whatIf=null;renderChrome();const m=MODULES.find(x=>x.key===S.tab);if(m&&m.live)render()},60000)}


/* ============ future model: the next three seasons ============ */
/* annual change in fantasy output by position and age, from typical aging curves */
function ageStep(pos,age){
  if(!age)return 1;
  if(pos==='RB')return age<=23?1.06:age<=25?1:age<=26?.94:age<=27?.88:.8;
  if(pos==='WR')return age<=23?1.1:age<=26?1.03:age<=28?1:age<=29?.93:.86;
  if(pos==='TE')return age<=24?1.12:age<=27?1.04:age<=29?1:age<=31?.92:.85;
  if(pos==='QB')return age<=25?1.08:age<=31?1.02:age<=34?1:age<=36?.92:.85;
  return 1;
}
const POSF=pos=>({QB:S.slots.includes('SUPER_FLEX')?1.25:.55,RB:1,WR:1,TE:.9}[pos]||1);
function basePpg(id){const r=S.ros[id]||0;const h=S.histPpg&&S.histPpg[id]||0;return Math.max(r,h*.9)}
/* points per game for player id, y seasons from now (0 = rest of this season) */
function ppgYear(id,y){
  const p=S.P[id];if(!p||!p.team&&y===0)return 0;
  let v=basePpg(id);if(y===0)return v;
  if(p.pos==='K'||p.pos==='DEF')return v;
  const age=p.age||26;
  if(age+y>=({QB:40,RB:32,WR:34,TE:35}[p.pos]||34))return 0;
  let f=1;for(let k=0;k<y;k++)f*=ageStep(p.pos,age+k);
  if(p.exp===0)f*=1.1;
  let curve=v*f;
  // young players the market prices well above their current production are read as breakouts in progress
  const val=S.val[id]||0;
  if(age+y<=26&&val>0){const implied=27*Math.pow(val/(9500*POSF(p.pos)),1/1.7);if(implied>curve)curve=curve*.5+implied*.5*Math.min(1,.7+.15*y)}
  return Math.max(0,curve);
}
/* a draft pick becomes a rookie; expected points per game by round and likely slot */
function rookiePpg(pk,yearsAfterDraft){
  const n=S.teams.length,rk=(S.dynRankNoPicks||{})[pk.orig]||Math.ceil(n/2);
  const slot=rk>2*n/3?'early':rk<=n/3?'late':'mid';
  const base={1:{early:10,mid:8,late:6.5},2:{early:5.5,mid:5,late:4.5},3:{early:3,mid:3,late:3}}[pk.round];
  const b=base?base[slot]:1.5;return b*Math.pow(1.12,yearsAfterDraft);
}
function optimizeItems(items){
  const pool=[...items].sort((a,b)=>b.pts-a.pts),used=new Set();let total=0;const lineup=[];
  for(const s of S.slotsSorted){const i=pool.findIndex((p,k)=>!used.has(k)&&ELIG[s].includes(p.pos));if(i>=0){used.add(i);total+=pool[i].pts;lineup.push({slot:s,...pool[i]})}}
  return{total,lineup};
}
function computeFuture(){
  const T=S.teams,s0=Number(S.season),n=T.length;
  // season-to-date points per game from league matchups, a fallback when weekly projections are thin
  S.histPpg={};const cnt={};
  for(const w of S.doneWeeks||[])for(const m of S.mu[w]||[])for(const id of (m.starters||[])){const v=(m.players_points||{})[id];if(v==null)continue;S.histPpg[id]=(S.histPpg[id]||0)+v;cnt[id]=(cnt[id]||0)+1}
  for(const id in S.histPpg)S.histPpg[id]/=cnt[id];
  // week-to-week volatility of every rostered player, from the league's own box scores (zeros skipped: usually a bye or a DNP)
  const sum={},sq={},nn={};
  for(const w of S.doneWeeks||[])for(const m of S.mu[w]||[])for(const [id,v] of Object.entries(m.players_points||{})){if(!v)continue;sum[id]=(sum[id]||0)+v;sq[id]=(sq[id]||0)+v*v;nn[id]=(nn[id]||0)+1}
  S.vol={};for(const id in nn){const n=nn[id],mu=sum[id]/n;S.vol[id]={n,sd:Math.sqrt(Math.max(0,sq[id]/n-mu*mu)*n/Math.max(1,n-1))}}
  const YEARS=[0,1,2];
  T.forEach(t=>{
    t.fut=YEARS.map(y=>{
      const pool=t.players.filter(id=>S.P[id]&&(y>0||(!t.reserve.has(id)&&!t.taxi.has(id)))).map(id=>({id,pos:S.P[id].pos,pts:ppgYear(id,y)}));
      const rookies=(t.myPicks||[]).filter(pk=>pk.season-s0>=1&&pk.season-s0<=y).map(pk=>({pick:pk,pos:'WR',rk:true,pts:rookiePpg(pk,y-(pk.season-s0))}));
      const o=optimizeItems(pool.concat(rookies));
      return{total:o.total,lineup:o.lineup,rookies:o.lineup.filter(x=>x.rk).length};
    });
  });
  YEARS.forEach(y=>[...T].sort((a,b)=>b.fut[y].total-a.fut[y].total).forEach((t,i)=>t.fut[y].rank=i+1));
  const avg=YEARS.map(y=>T.reduce((s,t)=>s+t.fut[y].total,0)/n);
  T.forEach(t=>{
    const lu=t.fut[0].lineup.filter(x=>x.id);
    t.coreAge=(()=>{const a=lu.map(x=>S.P[x.id].pos!=='K'&&S.P[x.id].pos!=='DEF'?S.P[x.id].age:null).filter(Boolean);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null})();
    t.firsts=(t.myPicks||[]).filter(p=>p.round===1);
    t.ownNext1=(t.myPicks||[]).some(p=>p.round===1&&p.orig===t.rid&&p.season===pickSeasons()[0]);
    t.youngCore=t.players.filter(id=>S.P[id]&&S.P[id].age&&S.P[id].age<=24&&(S.val[id]||0)>=3000).sort((a,b)=>S.val[b]-S.val[a]);
    t.decliners=t.players.filter(id=>S.P[id]&&ppgYear(id,0)>=8).map(id=>({id,now:ppgYear(id,0),y2:ppgYear(id,2)})).filter(x=>x.y2<x.now*.8).sort((a,b)=>(b.now-b.y2)-(a.now-a.y2));
    t.risers=t.players.filter(id=>S.P[id]).map(id=>({id,now:ppgYear(id,0),y2:ppgYear(id,2)})).filter(x=>x.y2>=8&&x.y2>x.now*1.15).sort((a,b)=>(b.y2-b.now)-(a.y2-a.now));
    // position strength vs league average this season
    const byPos={};t.fut[0].lineup.forEach(x=>{if(x.id){const p=S.P[x.id].pos;byPos[p]=(byPos[p]||0)+x.pts}});t.posPts=byPos;
    t.vsAvg=YEARS.map(y=>t.fut[y].total-avg[y]);
  });
  const posAvg={};['QB','RB','WR','TE'].forEach(p=>posAvg[p]=T.reduce((s,t)=>s+(t.posPts[p]||0),0)/n);
  const top=Math.ceil(n*.4),mid=Math.ceil(n*.5);
  T.forEach(t=>{
    t.weakPos=['QB','RB','WR','TE'].map(p=>({p,d:(t.posPts[p]||0)-posAvg[p]})).sort((a,b)=>a.d-b.d)[0];
    t.strongPos=['QB','RB','WR','TE'].map(p=>({p,d:(t.posPts[p]||0)-posAvg[p]})).sort((a,b)=>b.d-a.d)[0];
    const r0=t.fut[0].rank,r2=t.fut[2].rank,nf=t.firsts.length;let k;
    if(r0<=2&&r2<=3)k='dynasty';
    else if(r0<=top&&r2<=mid)k='contender';
    else if(r0<=top)k='winnow';
    else if(r2<=top&&r2<r0)k='rising';
    else if(r0>n-3&&t.ownNext1&&(nf>=2||r2<r0))k='tanking';
    else if(r0>n*.6&&(nf>=2||t.youngCore.length>=2||r2<r0))k='rebuild';
    else k='purgatory';
    t.outlook=k;t.tier=OUTLOOK[k].label;
  });
}
const OUTLOOK={
  dynasty:{label:'Dynasty',tone:'good',line:'Contending now and still on top in three years.'},
  contender:{label:'Contender',tone:'good',line:'Built to win this year, with a core that holds up.'},
  winnow:{label:'Win now, window closing',tone:'warn',line:'Strong today, but the roster fades over the next two seasons.'},
  rising:{label:'Rising',tone:'good',line:'Not there yet, but young talent and picks push this team up.'},
  rebuild:{label:'Rebuilding',tone:'warn',line:'Out of the race this year, collecting youth and picks for later.'},
  tanking:{label:'Tanking',tone:'bad',line:'Near the bottom and owns its own first, so every loss helps the draft slot.'},
  purgatory:{label:'Stuck in the middle',tone:'bad',line:'Not good enough to win, not bad enough to get the best picks.'}
};
function outlookAdvice(t){
  const nm=id=>S.P[id]?S.P[id].n:'';const w=t.weakPos,sell=t.decliners.slice(0,2).map(x=>nm(x.id)).join(' and ');
  switch(t.outlook){
    case'dynasty':return `Keep the core. Use spare depth to patch ${w.p}, the one spot below the league average.`;
    case'contender':return `Push for the title: trade a future pick or bench depth for a ${w.p} upgrade.${sell?` Keep an eye on ${sell}, who project to decline.`:''}`;
    case'winnow':return `The window is this season. Go all in on ${w.p}${sell?`, and plan to sell ${sell} before their value drops`:''}.`;
    case'rising':return `Be patient. Buy young players at ${w.p} and avoid trading the picks that fuel the rise.`;
    case'rebuild':return `${sell?`Sell ${sell} for first-round picks now. `:''}Target players 24 and under, and stockpile ${S.season*1+1} and ${S.season*1+2} firsts.`;
    case'tanking':return `Your own first-round pick is the prize. ${sell?`Move ${sell} while they still score. `:''}Don't trade future firsts for veterans.`;
    default:return `Pick a direction. Either buy a ${w.p} upgrade and chase the playoffs, or sell ${sell||'your veterans'} and rebuild.`;
  }
}

/* how much a player's weekly score swings: position baseline, blended with his real volatility once he has 3+ games */
function playerSd(id,mean){
  const p=S.P[id]||{};const r={QB:.33,RB:.5,WR:.58,TE:.65,K:.4,DEF:.55}[p.pos]||.5;const base=Math.max(2,mean*r);
  const v=S.vol&&S.vol[id];if(v&&v.n>=3)return Math.max(2,Math.sqrt(.5*base*base+.5*v.sd*v.sd));return base;
}
const floorOf=(m,sd)=>Math.max(0,m-1.28*sd),ceilOf=(m,sd)=>m+1.28*sd;

/* ============ playoff brackets ============ */
/* Sleeper's losers bracket doesn't say whether "w" is the team that won the game or the team that advanced toward the bottom,
   so read it from the real scores of the first consolation round. Returns champion, runner-up, third place and the
   toilet bowl loser (the last team standing at the bottom). mu is {week: matchups}. */
function bracketResult(wb,lb,mu,pws){
  const out={champ:null,runner:null,third:null,toilet:null,mode:null};
  const f=(b,p)=>(b||[]).find(m=>m.p===p&&m.w);
  const g1=f(wb,1),g3=f(wb,3);if(g1){out.champ=g1.w;out.runner=g1.l}if(g3)out.third=g3.w;
  const done=(lb||[]).filter(m=>m.w&&m.l);if(!done.length)return out;
  let toiletMode=false;const r1=done.filter(m=>m.r===1);
  for(const m of r1){const pts={};for(const x of (mu&&mu[pws])||[])pts[x.roster_id]=x.points||0;
    if(pts[m.w]!=null&&pts[m.l]!=null&&pts[m.w]!==pts[m.l]){toiletMode=pts[m.w]<pts[m.l];break}}
  out.mode=toiletMode?'toilet':'consolation';
  if(toiletMode){const p1=done.find(m=>m.p===1);out.toilet=p1?p1.w:null}
  else{const last=done.filter(m=>m.p).sort((a,b)=>b.p-a.p)[0];out.toilet=last?last.l:null}
  return out;
}
