/* Sportsbook: play-money betting on the league. Nothing here is real money and nothing can be cashed out.
   Every price comes from the same projections and simulations as the rest of Dynasty Room, with a 5% house edge.
   Bets are stored on the device (localStorage) and settle automatically from real Sleeper results. */
const VIG=0.05,START_BANK=1000;
const B={slip:[],mode:'parlay',stake:50,fmt:store.get('wr_oddsfmt')||'us',msg:'',sec:'games',ppos:'ALL',pmu:'all'};
const money=x=>(x<0?'-$':'$')+f0(Math.abs(x));
/* where bets live: this browser in dev mode, the account (Supabase table "bets") when accounts are on */
const BKR={mine:null,league:null,names:{},loading:false};
const bkKey=()=>`wr_book_${S.leagueId}_${S.season}_${S.username.toLowerCase()}`;
const remote=()=>ACC.mode==='live'&&!!ACC.session;
function bkLoad(){
  if(remote())return{bank:START_BANK,bets:BKR.mine||[]};
  try{const d=JSON.parse(store.get(bkKey())||'null');if(d&&Array.isArray(d.bets))return d}catch(e){}
  try{const old=JSON.parse(store.get(`wr_book_${S.leagueId}_${S.username.toLowerCase()}`)||'null');if(old&&Array.isArray(old.bets))return old}catch(e){}
  return{bank:START_BANK,bets:[]}}
function bkSave(d){store.set(bkKey(),JSON.stringify(d))}
async function bkFetch(){
  if(!remote()||BKR.loading)return;BKR.loading=true;
  const uid=ACC.session.user.id;
  const {data,error}=await ACC.sb.from('bets').select('id,user_id,bet,placed_at').eq('league_id',S.leagueId).eq('season',Number(S.season)).order('placed_at');
  if(error){console.error(error);BKR.loading=false;return}
  const rows=(data||[]).map(r=>({...r.bet,id:r.id,user_id:r.user_id,placed:r.placed_at}));
  BKR.mine=rows.filter(r=>r.user_id===uid);BKR.league=rows;
  const ids=[...new Set(rows.map(r=>r.user_id))];
  if(ids.length){const {data:n}=await ACC.sb.from('profile_names').select('id,sleeper_username').in('id',ids);(n||[]).forEach(x=>BKR.names[x.id]=x.sleeper_username)}
  BKR.loading=false;if(S.tab==='book')bkRerender();
}
async function bkPlaceRemote(bets){
  const rows=bets.map(b=>({league_id:S.leagueId,season:Number(S.season),bet:b}));
  const {data,error}=await ACC.sb.from('bets').insert(rows).select('id,user_id,bet,placed_at');
  if(error)throw new Error(error.message);
  const got=(data||[]).map(r=>({...r.bet,id:r.id,user_id:r.user_id,placed:r.placed_at}));
  BKR.mine=(BKR.mine||[]).concat(got);BKR.league=(BKR.league||[]).concat(got);
}
document.addEventListener('wr:reset',()=>{BKR.mine=null;BKR.league=null;HS.proj={};HS.busy=false});
const priced=p=>{p=Math.min(.985,Math.max(.015,p));const d=1/Math.min(.995,p*(1+VIG));return Math.max(1.01,Math.round(d*100)/100)};
function oddsTxt(d){if(B.fmt==='dec')return d.toFixed(2);const a=d>=2?Math.round((d-1)*100/5)*5:-Math.round(100/(d-1)/5)*5;return a>0?'+'+a:String(a)}
const halfLine=x=>Math.round(x-.5)+.5;
const sgn=x=>x>0?'+'+x:String(x);
const tn=r=>S.byRid[r]?S.byRid[r].name:'?';
const pn=id=>S.P[id]?S.P[id].n:'Unknown player';
function oppOf(w,rid){const p=pairsOf(S.mu[w]).find(x=>x.some(m=>m.roster_id===rid));return p?p.find(m=>m.roster_id!==rid).roster_id:rid}
const mkOf=(w,rid)=>Math.min(rid,oppOf(w,rid));

/* ---------- when things are over ---------- */
function weekDone(w){if(w<S.week||(w===S.week&&S.weekOver))return (S.mu[w]||[]).some(m=>m.points>0);if(w>S.week)return false;
  const g=Object.values(S.games);return g.length>0&&g.every(x=>x.state==='post')&&(S.mu[w]||[]).some(m=>m.points>0)}
function bookWeek(){let w=S.week;if(weekDone(w))w++;return w<=S.regEnd+3&&pairsOf(S.mu[w]).length?w:null}
const gameOver=id=>{const g=S.games[(S.P[id]||{}).team];return !!g&&g.state==='post'};

/* ---------- distributions ---------- */
function weekStarters(w,rid){
  if(w===S.week){const m=(S.mu[w]||[]).find(x=>x.roster_id===rid);const st=m&&(m.starters||[]).filter(id=>id&&id!=='0'&&S.P[id]);if(st&&st.length)return st}
  const pr=S.proj[w]||{};return optimize(startable(S.byRid[rid]),id=>pr[id]||0).lineup.map(x=>x.id).filter(Boolean);
}
function playerDist(w,id,rid){
  if(w===S.week){const m=(S.mu[w]||[]).find(x=>x.roster_id===rid);const lp=livePlayer(id,((m&&m.players_points)||{})[id]||0);return{mean:lp.mean,sd:Math.max(.3,lp.sd*1.1),full:lp.full,actual:lp.actual}}
  const mean=(S.proj[w]||{})[id]||0;return{mean,sd:Math.max(3,mean*.5),full:mean,actual:0};
}
function teamDist(rid,w){
  if(w===S.week&&S.liveTeam[rid]&&S.liveTeam[rid].mean>0)return S.liveTeam[rid];
  const pr=S.proj[w]||{};const mean=optimize(startable(S.byRid[rid]),id=>pr[id]||0).total||S.byRid[rid].rosMean;
  return{mean,sd:Math.max(16,mean*.17),actual:0};
}

/* ---------- markets ---------- */
function buildMarkets(){
  const w=bookWeek();const M={w,games:[],hi:[],lo:[],tt:[],blow:[],ptop:[],props:[],duels:[],fut:{}};
  if(w){
    const pairs=pairsOf(S.mu[w]);
    const dists={};pairs.flat().forEach(m=>dists[m.roster_id]=teamDist(m.roster_id,w));
    for(const [a,b] of pairs){const A=dists[a.roster_id],Bd=dists[b.roster_id],mk=Math.min(a.roster_id,b.roster_id);
      const dm=A.mean-Bd.mean,sd=Math.sqrt(A.sd**2+Bd.sd**2),pA=Phi(dm/sd);
      const lineA=-halfLine(Math.abs(dm))*Math.sign(dm||1),pCover=1-Phi((-lineA-dm)/sd);
      const T=A.mean+Bd.mean,tl=halfLine(T),pOver=1-Phi((tl-T)/sd);
      const stA=weekStarters(w,a.roster_id),stB=weekStarters(w,b.roster_id);
      const lock=w===S.week&&stA.concat(stB).every(gameOver);
      M.games.push({mk,lock,a:a.roster_id,b:b.roster_id,A,B:Bd,
        ml:[{t:'ml',w,rid:a.roster_id,d:priced(pA)},{t:'ml',w,rid:b.roster_id,d:priced(1-pA)}],
        sp:[{t:'sp',w,rid:a.roster_id,opp:b.roster_id,line:lineA,d:priced(pCover)},{t:'sp',w,rid:b.roster_id,opp:a.roster_id,line:-lineA,d:priced(1-pCover)}],
        tot:[{t:'tot',w,a:a.roster_id,b:b.roster_id,line:tl,side:'o',d:priced(pOver)},{t:'tot',w,a:a.roster_id,b:b.roster_id,line:tl,side:'u',d:priced(1-pOver)}]});
      for(const [rid,D] of [[a.roster_id,A],[b.roster_id,Bd]]){const l=halfLine(D.mean),po=1-Phi((l-D.mean)/D.sd);
        M.tt.push({rid,mk,lock,mean:D.mean,o:{t:'tt',w,rid,side:'o',line:l,d:priced(po)},u:{t:'tt',w,rid,side:'u',line:l,d:priced(1-po)}})}
      // player over/unders and same-slot duels
      const side=(st,rid)=>st.map(id=>({id,rid,pos:S.P[id].pos,...playerDist(w,id,rid)}));
      const PA=side(stA,a.roster_id),PB=side(stB,b.roster_id);
      for(const p of PA.concat(PB)){if(p.full<1.5&&!p.actual)continue;const done=w===S.week&&gameOver(p.id);
        const l=Math.max(.5,halfLine(p.mean)),po=1-Phi((l-p.mean)/p.sd);
        M.props.push({...p,mk,lock:done,o:{t:'pou',w,pid:p.id,rid:p.rid,side:'o',line:l,d:priced(po)},u:{t:'pou',w,pid:p.id,rid:p.rid,side:'u',line:l,d:priced(1-po)}})}
      const used=new Set();
      for(const x of PA){const y=PB.find(q=>q.pos===x.pos&&!used.has(q.id));if(!y||x.full<1.5||y.full<1.5)continue;used.add(y.id);
        const px=Phi((x.mean-y.mean)/Math.sqrt(x.sd**2+y.sd**2)),done=w===S.week&&gameOver(x.id)&&gameOver(y.id);
        M.duels.push({mk,lock:done,x,y,dx:{t:'pdu',w,pid:x.id,opp:y.id,rid:x.rid,d:priced(px)},dy:{t:'pdu',w,pid:y.id,opp:x.id,rid:y.rid,d:priced(1-px)}})}
    }
    M.simPlayers=[];for(const [a,b] of pairs)for(const m of [a,b])for(const id of weekStarters(w,m.roster_id)){const d=playerDist(w,id,m.roster_id);M.simPlayers.push({id,rid:m.roster_id,mean:d.mean,sd:d.sd})}
    M.simPairs=pairs.map(([a,b])=>[a.roster_id,b.roster_id]);
    // specials by simulation: top and lowest team, biggest blowout, top scoring player
    const rids=Object.keys(dists).map(Number),N=6000,hi={},lo={},bl={};rids.forEach(r=>{hi[r]=0;lo[r]=0});
    const mks=M.games.map(g=>g.mk);mks.forEach(k=>bl[k]=0);
    const pl=M.props.filter(p=>p.full>=4||p.actual>=4),top={};pl.forEach(p=>top[p.id]=0);
    for(let n=0;n<N;n++){const v={};let bi=0,li=0,bv=-1e9,lv=1e9;
      for(const r of rids){const d=dists[r];const x=d.mean+d.sd*gauss();v[r]=x;if(x>bv){bv=x;bi=r}if(x<lv){lv=x;li=r}}
      hi[bi]++;lo[li]++;let bm=-1,bk=null;for(const g of M.games){const m=Math.abs(v[g.a]-v[g.b]);if(m>bm){bm=m;bk=g.mk}}bl[bk]++;
      let tp=null,tv=-1e9;for(const p of pl){const x=p.mean+p.sd*gauss();if(x>tv){tv=x;tp=p.id}}if(tp)top[tp]++}
    M.hi=rids.map(r=>({t:'hi',w,rid:r,d:priced(hi[r]/N)})).sort((x,y)=>x.d-y.d);
    M.lo=rids.map(r=>({t:'lo',w,rid:r,d:priced(lo[r]/N)})).sort((x,y)=>x.d-y.d);
    M.blow=M.games.map(g=>({t:'blow',w,a:g.a,b:g.b,mk:g.mk,d:priced(bl[g.mk]/N)})).sort((x,y)=>x.d-y.d);
    M.ptop=pl.map(p=>({t:'ptop',w,pid:p.id,rid:p.rid,d:priced(top[p.id]/N)})).sort((x,y)=>x.d-y.d).slice(0,15);
  }
  const sim=S.sim||{},regOver=S.week>S.regEnd;
  const fut=(t,k)=>S.teams.map(x=>({t,rid:x.rid,d:priced((sim[x.rid]||{})[k]||0)})).sort((x,y)=>x.d-y.d);
  M.fut={champ:fut('champ','champ'),toilet:fut('toilet','toilet'),seed1:regOver?[]:fut('seed1','one'),last:regOver?[]:fut('last','last'),
    po:regOver?[]:S.teams.map(x=>{const p=(sim[x.rid]||{}).po||0;return{rid:x.rid,yes:{t:'po',rid:x.rid,yes:true,d:priced(p)},no:{t:'po',rid:x.rid,yes:false,d:priced(1-p)}}}),
    wins:regOver?[]:S.teams.map(x=>{const s=sim[x.rid]||{},l=halfLine(s.wins||0),sd=Math.max(.35,s.winsSd||.8),po=1-Phi((l-s.wins)/sd);
      return{rid:x.rid,line:l,o:{t:'wins',rid:x.rid,side:'o',line:l,d:priced(po)},u:{t:'wins',rid:x.rid,side:'u',line:l,d:priced(1-po)}}}).sort((a,b)=>b.line-a.line)};
  return M;
}

function legLabel(l){switch(l.t){
  case'ml':return `${tn(l.rid)} to win, week ${l.w}`;
  case'sp':return `${tn(l.rid)} ${sgn(l.line)} vs ${tn(l.opp)}, week ${l.w}`;
  case'tot':return `${l.side==='o'?'Over':'Under'} ${l.line} total points, ${tn(l.a)} vs ${tn(l.b)}, week ${l.w}`;
  case'tt':return `${tn(l.rid)} ${l.side==='o'?'over':'under'} ${l.line} points, week ${l.w}`;
  case'pou':return `${pn(l.pid)} ${l.side==='o'?'over':'under'} ${l.line} fantasy points, week ${l.w}`;
  case'pdu':return `${pn(l.pid)} outscores ${pn(l.opp)}, week ${l.w}`;
  case'ptop':return `${pn(l.pid)} top-scoring starter in the league, week ${l.w}`;
  case'hi':return `${tn(l.rid)} top-scoring team of week ${l.w}`;
  case'lo':return `${tn(l.rid)} lowest-scoring team of week ${l.w}`;
  case'blow':return `${tn(l.a)} vs ${tn(l.b)} is the biggest blowout of week ${l.w}`;
  case'champ':return `${tn(l.rid)} wins the championship`;
  case'toilet':return `${tn(l.rid)} loses the toilet bowl`;
  case'seed1':return `${tn(l.rid)} finishes as the #1 seed`;
  case'last':return `${tn(l.rid)} finishes last in the regular season`;
  case'po':return `${tn(l.rid)} ${l.yes?'makes':'misses'} the playoffs`;
  case'wins':return `${tn(l.rid)} ${l.side==='o'?'over':'under'} ${l.line} regular-season wins`}}
const legKey=l=>[l.t,l.w,l.rid,l.pid,l.opp,l.a,l.side,l.line,l.yes].join('|');

/* Parlays. Legs from the same week are priced together by simulating that week player by player, so a same-game parlay
   (a player's over plus his team's moneyline, a moneyline plus the total) pays what its real joint chance is worth.
   Only picks that can't all win together, and two futures on the same team or market, are refused. */
function futConflict(){const f=B.slip.filter(l=>l.w==null);for(let i=0;i<f.length;i++)for(let k=i+1;k<f.length;k++)if(f[i].rid===f[k].rid||f[i].t===f[k].t)return true;return false}
function simWeek(M){
  const p={},t={};for(const r of M.simPairs.flat())t[r]=0;
  for(const x of M.simPlayers){const v=x.mean+x.sd*gauss();p[x.id]=v;t[x.rid]+=v}
  return{t,p,st:M.simPlayers.map(x=>x.id),pairs:M.simPairs};
}
function priceParlay(legs){
  const ind=legs.reduce((x,l)=>x*l.d,1);const wl=legs.filter(l=>l.w!=null);const M=S.bookM;
  if(wl.length<2||!M||!M.simPlayers||wl.some(l=>l.w!==M.w))return{d:ind,factor:1,impossible:false};
  const N=8000,marg=wl.map(()=>0);let joint=0;
  for(let n=0;n<N;n++){const W=simWeek(M);let all=true;wl.forEach((l,i)=>{const o=legOutcome(l,W);if(o==='win')marg[i]++;else all=false});if(all)joint++}
  const pj=joint/N,pi=marg.reduce((x,m)=>x*Math.max(m,1)/N,1);
  if(pj<.002)return{d:ind,factor:0,impossible:true};
  const factor=Math.min(4,Math.max(.25,pj/pi));
  return{d:Math.max(1.01,Math.round(ind/factor*100)/100),factor,impossible:false};
}
let parlayCache={key:'',v:null};
function parlayPrice(){const k=B.slip.map(legKey).join('#');if(parlayCache.key!==k)parlayCache={key:k,v:priceParlay(B.slip)};return parlayCache.v}

/* ---------- settlement from real Sleeper data ---------- */
function weekPts(w){const t={},p={},st=[];(S.mu[w]||[]).forEach(m=>{t[m.roster_id]=m.points||0;Object.assign(p,m.players_points||{});(m.starters||[]).forEach(id=>{if(id&&id!=='0')st.push(id)})});return{t,p,st}}
function standingsFinal(){if(S.week<=S.regEnd||!weekDone(S.regEnd))return null;
  const rec={};S.teams.forEach(t=>rec[t.rid]={w:0,pf:0});
  for(let w=1;w<=S.regEnd;w++)pairsOf(S.mu[w]).forEach(([a,b])=>{rec[a.roster_id].pf+=a.points||0;rec[b.roster_id].pf+=b.points||0;if(a.points>b.points)rec[a.roster_id].w++;else if(b.points>a.points)rec[b.roster_id].w++;else{rec[a.roster_id].w+=.5;rec[b.roster_id].w+=.5}});
  return{order:S.teams.map(t=>t.rid).sort((x,y)=>rec[y].w-rec[x].w||rec[y].pf-rec[x].pf),rec}}
/* W = {t:{roster:points}, p:{player:points}, st:[starters], pairs:[[roster,roster]]} from real results or one simulated week */
function legOutcome(l,W){
  const cmp=(x,y)=>x>y?'win':x<y?'loss':'push',pts=W.t,opp=r=>{const p=W.pairs.find(x=>x.includes(r));return p?p.find(x=>x!==r):r};
  switch(l.t){case'ml':return cmp(pts[l.rid],pts[opp(l.rid)]);
    case'sp':return cmp(pts[l.rid]+l.line,pts[l.opp]);
    case'tot':{const T=pts[l.a]+pts[l.b];return l.side==='o'?cmp(T,l.line):cmp(l.line,T)}
    case'tt':return l.side==='o'?cmp(pts[l.rid],l.line):cmp(l.line,pts[l.rid]);
    case'pou':{const v=W.p[l.pid];if(v==null)return'push';return l.side==='o'?cmp(v,l.line):cmp(l.line,v)}
    case'pdu':{const x=W.p[l.pid],y=W.p[l.opp];if(x==null||y==null)return'push';return cmp(x,y)}
    case'ptop':{let mx=-1e9;for(const id of W.st){const v=W.p[id]||0;if(v>mx)mx=v}return W.st.includes(l.pid)&&(W.p[l.pid]||0)===mx?'win':'loss'}
    case'hi':case'lo':{const v=Object.values(pts),x=l.t==='hi'?Math.max(...v):Math.min(...v);return pts[l.rid]===x?'win':'loss'}
    case'blow':{let bk=null,bm=-1;W.pairs.forEach(([a,b])=>{const m=Math.abs((pts[a]||0)-(pts[b]||0));if(m>bm){bm=m;bk=Math.min(a,b)}});return bk===Math.min(l.a,l.b)?'win':'loss'}}
  return null}
function settleLeg(l){
  const cmp=(x,y)=>x>y?'win':x<y?'loss':'push';
  if(l.w!=null){if(!weekDone(l.w))return null;const W=weekPts(l.w);W.pairs=pairsOf(S.mu[l.w]).map(([a,b])=>[a.roster_id,b.roster_id]);return legOutcome(l,W)}
  const F=standingsFinal(),st=F&&F.order;const nPO=Math.min(S.league.settings.playoff_teams||6,S.teams.length);
  switch(l.t){
    case'seed1':return st?(st[0]===l.rid?'win':'loss'):null;
    case'last':return st?(st[st.length-1]===l.rid?'win':'loss'):null;
    case'po':return st?((st.indexOf(l.rid)<nPO)===l.yes?'win':'loss'):null;
    case'wins':return F?(l.side==='o'?cmp(F.rec[l.rid].w,l.line):cmp(l.line,F.rec[l.rid].w)):null;
    case'champ':{const f=(S.wb||[]).find(m=>m.p===1&&m.w);return f?(f.w===l.rid?'win':'loss'):(st&&st.indexOf(l.rid)>=nPO?'loss':null)}
    case'toilet':{const t=bracketResult(S.wb,S.lb,S.mu,(S.league.settings||{}).playoff_week_start||15).toilet;return t?(t===l.rid?'win':'loss'):(st&&st.indexOf(l.rid)<nPO?'loss':null)}}
  return null}
function settleBet(b){const r=b.legs.map(settleLeg);if(r.includes('loss'))return{st:'loss',pay:0,r};if(r.includes(null))return{st:'open',r};
  const d=(b.pd||b.legs.reduce((x,l)=>x*l.d,1))/b.legs.reduce((x,l,i)=>x*(r[i]==='push'?l.d:1),1);return{st:r.every(x=>x==='push')?'push':'win',pay:b.stake*Math.max(1,d),r}}
function ledger(list){const d=list?{bank:START_BANK,bets:list}:bkLoad();let bank=d.bank,won=0,lost=0,open=0,pl=0,staked=0;
  const rows=d.bets.map(b=>{const s=settleBet(b);staked+=b.stake;if(s.st==='open'){bank-=b.stake;open++}else{bank+=s.pay-b.stake;pl+=s.pay-b.stake;if(s.st==='win')won++;if(s.st==='loss')lost++}return{b,...s}});
  return{d,bank,won,lost,open,pl,staked,rows}}

/* ---------- view ---------- */
function oddBtn(l,label,lock){const on=B.slip.some(x=>legKey(x)===legKey(l));
  if(lock)return `<button class="odd" disabled><span class="ol">${label||''}</span><span class="ov">Final</span></button>`;
  return `<button class="odd" data-leg='${h(JSON.stringify(l))}' aria-pressed="${on}">${label?`<span class="ol">${label}</span>`:''}<span class="ov num">${oddsTxt(l.d)}</span></button>`}
const SECS=[['games','Matchups'],['props','Player props'],['specials','Specials'],['futures','Futures'],['hind','Hindsight'],['board','Leaderboard'],['mine','My bets']];
const FREE_SECS=new Set(['games','mine']);
function rBook(){
  if(remote()&&BKR.mine===null){bkFetch();return `<h2>Sportsbook</h2><div class="status">Loading your bets…</div>`}
  const M=S.bookM=S.bookM||buildMarkets();const LG=ledger();
  const live=M.w===S.week&&Object.values(S.games).some(g=>g.state!=='pre');
  const hdr=`<h2>Sportsbook</h2><p class="lede">What would have happened with money on the line? Lines on ${h(S.league.name)}${live?', updating live with the games':''}, priced from our projections and Monte Carlo simulations with a 5% house edge and settled from real Sleeper scores. <b>Play money only:</b> everyone starts the season with $${f0(START_BANK)} that isn’t real and can’t be cashed out.</p>
  <div class="bk-bar"><div><div class="num bk-big">${money(LG.bank)}</div><div class="psub">play money available</div></div>
   <div><div class="num bk-mid ${LG.pl>=0?'up':'down'}">${LG.pl>=0?'+':''}${money(LG.pl)}</div><div class="psub">profit, ${LG.won}-${LG.lost} record</div></div>
   <div><div class="num bk-mid">${LG.open}</div><div class="psub">open bets</div></div>
   <div class="chips" style="margin-left:auto"><button class="chip" data-fmt="us" aria-pressed="${B.fmt==='us'}">American</button><button class="chip" data-fmt="dec" aria-pressed="${B.fmt==='dec'}">Decimal</button></div></div>
  <nav class="chips bk-secs" aria-label="Sportsbook sections">${SECS.map(([k,l])=>`<button class="chip" data-sec="${k}" aria-pressed="${B.sec===k}">${l}${k==='mine'&&LG.open?` (${LG.open})`:''}${!FREE_SECS.has(k)&&needsPro('book')?' <span class="lock" aria-label="Premium">Pro</span>':''}</button>`).join('')}</nav>`;
  const body=!FREE_SECS.has(B.sec)&&needsPro('book')?`<div style="margin-top:14px">${proCard('book')}</div>`:({games:bkGames,props:bkProps,specials:bkSpecials,futures:bkFutures,hind:bkHindsight,board:bkBoard,mine:bkMine}[B.sec]||bkGames)(M,LG);
  return `${hdr}<div class="bk-layout"><div>${body}</div><aside id="slip">${rSlip(LG.bank)}</aside></div>
  ${B.slip.length?`<a class="bk-float" id="bkFloat" href="#slip">${floatText()}</a>`:''}`;
}
const noWeek=`<div class="panel">No weekly matchups left to bet on this season. Futures are still open.</div>`;
function bkGames(M){
  if(!M.w)return noWeek;
  return `<h3>Week ${M.w} lines</h3><div class="panel bk-games">
    <div class="bk-row bk-head"><span></span><span>Spread</span><span>To win</span><span>Total</span></div>
    ${M.games.map(g=>[0,1].map(i=>{const rid=i?g.b:g.a,d=i?g.B:g.A;return `<div class="bk-row ${i?'bk-second':''}">
      <div><div class="pname">${h(tn(rid))}${rid===S.meRid?' <span class="tag">You</span>':''}</div><div class="psub">Projected ${f1(d.mean)}${d.actual?`, ${f1(d.actual)} scored`:''}</div></div>
      ${oddBtn(g.sp[i],sgn(g.sp[i].line),g.lock)}${oddBtn(g.ml[i],'',g.lock)}${oddBtn(g.tot[i],(i?'U ':'O ')+g.tot[i].line,g.lock)}</div>`}).join('')).join('')}</div>
  <h3>Team totals</h3><div class="panel">${M.tt.map(x=>`<div class="bk-li"><span><span class="pname">${h(tn(x.rid))}</span> <span class="psub">projected ${f1(x.mean)}</span></span><span class="bk-yn">${oddBtn(x.o,'O '+x.o.line,x.lock)}${oddBtn(x.u,'U '+x.u.line,x.lock)}</span></div>`).join('')}</div>`;
}
function bkProps(M){
  if(!M.w)return noWeek;
  const pos=['ALL','QB','RB','WR','TE','K','DEF'].filter(p=>p==='ALL'||M.props.some(x=>x.pos===p));
  const flt=x=>(B.ppos==='ALL'||x.pos===B.ppos)&&(B.pmu==='all'||String(x.mk)===B.pmu);
  const opts=`<option value="all">All matchups</option>${M.games.map(g=>`<option value="${g.mk}" ${String(g.mk)===B.pmu?'selected':''}>${h(tn(g.a))} vs ${h(tn(g.b))}</option>`).join('')}`;
  const groups=M.games.filter(g=>B.pmu==='all'||String(g.mk)===B.pmu).map(g=>{const ps=M.props.filter(x=>x.mk===g.mk&&flt(x)).sort((a,b)=>b.mean-a.mean);if(!ps.length)return '';
    return `<div class="panel" style="margin-bottom:14px"><h3 style="margin-top:0">${h(tn(g.a))} vs ${h(tn(g.b))}</h3>
    ${ps.map(p=>`<div class="bk-li"><span><span class="pname">${h(pn(p.id))}</span> <span class="pos ${p.pos}">${p.pos}</span><div class="psub">${h(tn(p.rid))}, projected ${f1(p.mean)}${p.actual?`, ${f1(p.actual)} so far`:''}</div></span>
      <span class="bk-yn">${oddBtn(p.o,'O '+p.o.line,p.lock)}${oddBtn(p.u,'U '+p.u.line,p.lock)}</span></div>`).join('')}</div>`}).join('');
  const duels=M.duels.filter(d=>(B.ppos==='ALL'||d.x.pos===B.ppos)&&(B.pmu==='all'||String(d.mk)===B.pmu));
  return `<div class="row" style="margin-top:14px"><select id="bkMu" aria-label="Matchup">${opts}</select><div class="chips">${pos.map(p=>`<button class="chip" data-ppos="${p}" aria-pressed="${B.ppos===p}">${p==='ALL'?'All':p}</button>`).join('')}</div></div>
  <h3>Player duels</h3><p class="psub" style="margin:-4px 0 10px">Same position, head to head, inside each week ${M.w} matchup. Who scores more fantasy points?</p>
  <div class="panel">${duels.length?duels.map(d=>`<div class="bk-duel"><div>${oddBtn(d.dx,'',d.lock)}<span><span class="pname">${h(pn(d.x.id))}</span><div class="psub">${h(tn(d.x.rid))}, ${f1(d.x.mean)}</div></span></div>
    <span class="pos ${d.x.pos}">${d.x.pos}</span>
    <div class="r"><span><span class="pname">${h(pn(d.y.id))}</span><div class="psub">${h(tn(d.y.rid))}, ${f1(d.y.mean)}</div></span>${oddBtn(d.dy,'',d.lock)}</div></div>`).join(''):'<p class="mute" style="margin:0">No duels for this filter.</p>'}</div>
  <h3>Fantasy points over/under</h3><p class="psub" style="margin:-4px 0 10px">Every projected starter in the league, scored with La Dinastía's settings. If a player isn't on a roster when the week settles, the pick is void.</p>${groups||'<div class="panel mute">No players for this filter.</div>'}`;
}
function bkSpecials(M){
  if(!M.w)return noWeek;
  const list=(arr,lab)=>arr.map(l=>`<div class="bk-li"><span>${lab(l)}</span>${oddBtn(l)}</div>`).join('');
  return `<div class="grid2" style="margin-top:14px">
   <div class="panel"><h3 style="margin-top:0">Top-scoring team, week ${M.w}</h3>${list(M.hi,l=>h(tn(l.rid)))}</div>
   <div class="panel"><h3 style="margin-top:0">Lowest-scoring team, week ${M.w}</h3>${list(M.lo,l=>h(tn(l.rid)))}</div>
   <div class="panel"><h3 style="margin-top:0">Top-scoring starter in the league</h3>${list(M.ptop,l=>`<span class="pname">${h(pn(l.pid))}</span> <span class="psub">${h(tn(l.rid))}</span>`)}</div>
   <div class="panel"><h3 style="margin-top:0">Biggest blowout</h3>${list(M.blow,l=>`${h(tn(l.a))} vs ${h(tn(l.b))}`)}</div></div>`;
}
function bkFutures(M){
  const F=M.fut,list=(arr,title,note)=>arr.length?`<div class="panel"><h3 style="margin-top:0">${title}</h3>${note?`<p class="psub" style="margin:-4px 0 8px">${note}</p>`:''}${arr.map(l=>`<div class="bk-li"><span>${h(tn(l.rid))}</span>${oddBtn(l)}</div>`).join('')}</div>`:'';
  const two=(arr,title,a,b,lab)=>arr.length?`<div class="panel"><h3 style="margin-top:0">${title}</h3>${arr.map(x=>`<div class="bk-li"><span>${h(tn(x.rid))}</span><span class="bk-yn">${oddBtn(x[a],lab?lab(x,a):'Yes')}${oddBtn(x[b],lab?lab(x,b):'No')}</span></div>`).join('')}</div>`:'';
  return `<div class="grid2" style="margin-top:14px">${list(F.champ,'Champion')}${list(F.toilet,'Toilet bowl loser','Misses the playoffs and loses every consolation game down to the bottom.')}
   ${two(F.po,'Make the playoffs','yes','no')}${two(F.wins,'Regular-season wins','o','u',(x,k)=>(k==='o'?'O ':'U ')+x.line)}
   ${list(F.seed1,'#1 seed')}${list(F.last,'Last place, regular season')}</div>`;
}
function bkMine(M,LG){
  if(!LG.rows.length)return `<div class="panel" style="margin-top:14px">No bets yet. Pick any odds to start a bet slip.</div>`;
  return `<div class="panel scroll" style="margin-top:14px"><table><thead><tr><th>Bet</th><th class="r">Stake</th><th class="r">Odds</th><th>Status</th><th class="r">Return</th></tr></thead><tbody>
    ${[...LG.rows].reverse().map(r=>{const d=r.b.pd||r.b.legs.reduce((x,l)=>x*l.d,1);const st={open:'Open',win:'Won',loss:'Lost',push:'Push'}[r.st];
      return `<tr><td>${r.b.legs.length>1?`<b>${r.b.legs.length}-leg parlay</b><div class="psub">${r.b.legs.map((l,i)=>h(legLabel(l))+(r.r[i]?` <span class="${r.r[i]==='win'?'up':r.r[i]==='loss'?'down':''}">(${r.r[i]})</span>`:'')).join('<br>')}</div>`:h(legLabel(r.b.legs[0]))}</td>
      <td class="r num">${money(r.b.stake)}</td><td class="r num">${oddsTxt(d)}</td><td><span class="tag ${r.st==='win'?'good':r.st==='loss'?'bad':''}">${st}</span></td>
      <td class="r num">${r.st==='open'?money(r.b.stake*d)+' to return':money(r.pay)}</td></tr>`}).join('')}</tbody></table></div>
  <div class="row" style="margin-top:10px"><button class="btn ghost" id="bkShare">Copy my bets for the group chat</button><button class="btn ghost" id="bkReset">Start over with $${f0(START_BANK)}</button><span class="mute" id="bkShareMsg"></span></div>`;
}
/* ---------- Hindsight: what betting every game would have done ---------- */
const HS={proj:{},busy:false,open:null};
function hsWeeks(){return range(1,Math.min(S.week,S.regEnd+3)).filter(w=>weekDone(w)&&pairsOf(S.mu[w]).length)}
function hsLoad(ws){const need=ws.filter(w=>!HS.proj[w]&&!S.proj[w]);if(!need.length||HS.busy)return !need.length;HS.busy=true;
  Promise.all(need.map(w=>tj(projURL(S.season,w)).then(rows=>{const m={};(rows||[]).forEach(r=>{const p=S.P[r.player_id];if(p)m[r.player_id]=ptsFromStats(r.stats,p.pos)});HS.proj[w]=m})))
    .then(()=>{HS.busy=false;if(S.tab==='book'&&B.sec==='hind')bkRerender()});return false}
function hsWeek(w){
  const pr=HS.proj[w]||S.proj[w]||{};
  return pairsOf(S.mu[w]).map(([a,b])=>{
    const side=m=>{const st=(m.starters||[]).filter(id=>id&&id!=='0');let mean=0,v=0;st.forEach(id=>{const x=pr[id]||0;mean+=x;v+=playerSd(id,x)**2});return{rid:m.roster_id,mean,sd:Math.sqrt(v+4),pts:m.points||0}};
    const A=side(a),Bs=side(b),dm=A.mean-Bs.mean,sd=Math.sqrt(A.sd**2+Bs.sd**2),pA=Phi(dm/sd);
    const fav=pA>=.5?A:Bs,dog=fav===A?Bs:A,pf=Math.max(pA,1-pA),line=halfLine(Math.abs(dm)),pc_=1-Phi((line-Math.abs(dm))/sd);
    const T=A.mean+Bs.mean,tl=halfLine(T),po=1-Phi((tl-T)/sd),act=A.pts+Bs.pts;
    const favWon=fav.pts>dog.pts,covered=fav.pts-dog.pts>line,over=act>tl;
    return{w,A,B:Bs,fav,dog,pf,line,tl,act,favWon,covered,over,d:{fav:priced(pf),dog:priced(1-pf),cov:priced(pc_),dogsp:priced(1-pc_),o:priced(po),u:priced(1-po)}};
  });
}
function bkHindsight(){
  const ws=hsWeeks();if(!ws.length)return `<div class="panel" style="margin-top:14px">Hindsight fills in once the first week is final.</div>`;
  if(!hsLoad(ws))return `<div class="status">Rebuilding each week's pregame lines from that week's projections…</div>`;
  const G=ws.flatMap(hsWeek),bet=(won,d)=>won?100*(d-1):-100;
  const strat=[
    ['Every favorite to win',g=>bet(g.favWon,g.d.fav)],['Every underdog to win',g=>bet(!g.favWon,g.d.dog)],
    ['Every favorite on the spread',g=>bet(g.covered,g.d.cov)],['Every underdog on the spread',g=>bet(!g.covered,g.d.dogsp)],
    ['Every over',g=>bet(g.over,g.d.o)],['Every under',g=>bet(!g.over,g.d.u)]];
  const mine=G.filter(g=>g.A.rid===S.meRid||g.B.rid===S.meRid);
  const meSide=g=>g.A.rid===S.meRid?g.A:g.B,other=g=>g.A.rid===S.meRid?g.B:g.A;
  if(mine.length&&S.inLeague){strat.push(['Your team every week',g=>{if(!mine.includes(g))return null;const me=meSide(g),won=me.pts>other(g).pts;return bet(won,me===g.fav?g.d.fav:g.d.dog)}]);
    strat.push(['Against your team every week',g=>{if(!mine.includes(g))return null;const me=meSide(g),won=me.pts<other(g).pts;return bet(won,me===g.fav?g.d.dog:g.d.fav)}])}
  const res=strat.map(([n,f])=>{let p=0,w=0,l=0;G.forEach(g=>{const x=f(g);if(x==null)return;p+=x;x>0?w++:l++});return{n,p,w,l}}).sort((a,b)=>b.p-a.p);
  const ups=G.filter(g=>!g.favWon).sort((a,b)=>b.pf-a.pf).slice(0,5);
  const favRate=G.filter(g=>g.favWon).length/G.length;
  const wk=HS.open||ws[ws.length-1];
  return `<p class="lede" style="margin-top:14px">Every finished week, re-priced with the projections Sleeper had before kickoff. Then: what if you had bet $100 of play money on every game the same way? Favorites won ${pc(favRate)} of ${G.length} games.</p>
  <div class="hs-grid">${res.map(r=>`<div class="panel hs-s"><div class="psub">${h(r.n)}</div><div class="num hx-big ${r.p>=0?'up':'down'}">${r.p>=0?'+':''}${money(r.p)}</div><div class="psub">${r.w}-${r.l} on $${f0((r.w+r.l)*100)} staked</div></div>`).join('')}</div>
  ${ups.length?`<h3>Biggest upsets</h3><div class="panel">${ups.map(g=>`<div class="bk-li"><span><span class="pname">${h(tn(g.dog.rid))}</span> beat <span class="pname">${h(tn(g.fav.rid))}</span><div class="psub">Week ${g.w}, ${f1(g.dog.pts)} to ${f1(g.fav.pts)}. Only ${pc(1-g.pf)} to win before kickoff; $100 would have paid ${money(100*g.d.dog)}.</div></span><span class="tag bad">${oddsTxt(g.d.dog)}</span></div>`).join('')}</div>`:''}
  <h3>Week by week</h3><div class="row"><select id="hsWeek" aria-label="Week">${ws.map(w=>`<option value="${w}" ${w===wk?'selected':''}>Week ${w}</option>`).join('')}</select></div>
  <div class="panel scroll"><table><thead><tr><th>Favorite</th><th>Underdog</th><th class="r">Pregame</th><th class="r">Total</th><th class="r">Final</th><th>What happened</th></tr></thead><tbody>
  ${hsWeek(wk).map(g=>`<tr><td><span class="pname">${h(tn(g.fav.rid))}</span><div class="psub">${oddsTxt(g.d.fav)}, proj ${f1(g.fav.mean)}</div></td><td><span class="pname">${h(tn(g.dog.rid))}</span><div class="psub">${oddsTxt(g.d.dog)}, proj ${f1(g.dog.mean)}</div></td>
    <td class="r num">-${g.line}</td><td class="r num">${g.tl}</td><td class="r num">${f1(g.fav.pts)} to ${f1(g.dog.pts)}</td>
    <td>${g.favWon?'<span class="tag good">Favorite won</span>':'<span class="tag bad">Upset</span>'} ${g.covered?'<span class="tag">Covered</span>':''} <span class="tag">${g.over?'Over':'Under'}</span></td></tr>`).join('')}</tbody></table></div>`;
}
/* ---------- league leaderboard (needs accounts) ---------- */
function bkBoard(M,LG){
  if(!remote())return `<div class="panel" style="margin-top:14px"><p style="margin:0">The league leaderboard needs accounts, so every manager’s bets are saved in one place. It turns on with sign-in; for now, here’s you: <b>${money(LG.bank)}</b>, ${LG.pl>=0?'+':''}${money(LG.pl)} profit.</p></div>`;
  const by={};(BKR.league||[]).forEach(b=>(by[b.user_id]=by[b.user_id]||[]).push(b));
  const rows=Object.entries(by).map(([uid,list])=>{const L=ledger(list);const best=L.rows.filter(r=>r.st==='win').sort((a,b)=>(b.pay-b.b.stake)-(a.pay-a.b.stake))[0];return{uid,L,best}}).sort((a,b)=>b.L.bank-a.L.bank);
  if(!rows.length)return `<div class="panel" style="margin-top:14px">Nobody in ${h(S.league.name)} has placed a bet yet. Be the first.</div>`;
  return `<p class="lede" style="margin-top:14px">Every manager in ${h(S.league.name)} who has bet this season, ranked by play money. Everyone started with $${f0(START_BANK)}.</p>
  <div class="panel scroll"><table><thead><tr><th>#</th><th>Manager</th><th class="r">Bankroll</th><th class="r">Profit</th><th class="r">Record</th><th class="r">Open</th><th>Best hit</th></tr></thead><tbody>
  ${rows.map((r,i)=>`<tr class="${r.uid===ACC.session.user.id?'me':''}"><td class="num">${i+1}</td><td class="pname">@${h(BKR.names[r.uid]||'manager')}</td><td class="r num">${money(r.L.bank)}</td><td class="r num ${r.L.pl>=0?'up':'down'}">${r.L.pl>=0?'+':''}${money(r.L.pl)}</td><td class="r num">${r.L.won}-${r.L.lost}</td><td class="r num">${r.L.open}</td>
    <td class="psub">${r.best?`${h(r.best.b.legs.length>1?r.best.b.legs.length+'-leg parlay':legLabel(r.best.b.legs[0]))}, +${money(r.best.pay-r.best.b.stake)}`:''}</td></tr>`).join('')}</tbody></table></div>`;
}
function rSlip(bank){
  if(!B.slip.length)return `<div class="panel"><h3 style="margin-top:0">Bet slip</h3><p class="mute" style="margin:0">Tap any odds to add a pick. Add two or more for a parlay.</p>${B.msg?`<p class="up" style="margin:8px 0 0">${h(B.msg)}</p>`:''}</div>`;
  if(needsPro('book')&&!B.userMode)B.mode='single';
  const multi=B.slip.length>1,parlay=multi&&B.mode==='parlay';
  const PP=parlay?parlayPrice():{d:B.slip.reduce((x,l)=>x*l.d,1),factor:1,impossible:false},pd=PP.d,stake=Math.max(0,Number(B.stake)||0);
  const fc=parlay&&futConflict();
  const total=parlay?stake:stake*B.slip.length,ret=parlay?stake*pd:B.slip.reduce((s,l)=>s+stake*l.d,0);
  const err=parlay&&needsPro('book')?'Parlays are a Premium feature. Switch to singles, or upgrade from your account.':parlay&&PP.impossible?'These picks can\u2019t all win together. Remove one of them.':fc?'Two futures on the same team or the same market can\u2019t share a parlay. Bet them as singles.':total>bank?'Not enough play money for that stake.':stake<=0?'Enter a stake.':'';
  return `<div class="panel"><h3 style="margin-top:0">Bet slip</h3>
   ${multi?`<div class="chips" style="margin-bottom:10px"><button class="chip" data-bm="parlay" aria-pressed="${B.mode==='parlay'}">Parlay</button><button class="chip" data-bm="single" aria-pressed="${B.mode==='single'}">Singles</button></div>`:''}
   ${B.slip.map((l,i)=>`<div class="bk-leg"><div>${h(legLabel(l))}<div class="num psub">${oddsTxt(l.d)}</div></div><button class="bk-x" data-rm="${i}" aria-label="Remove pick">×</button></div>`).join('')}
   ${parlay?`<div class="bk-leg"><span><b>${B.slip.length}-leg parlay</b>${Math.abs(PP.factor-1)>.06&&!PP.impossible?`<div class="psub">These picks move together, so the price is ${PP.factor>1?'shortened':'boosted'} to their real joint chance.</div>`:''}</span><b class="num">${oddsTxt(pd)}</b></div>`:''}
   <label class="bk-stake">${parlay||!multi?'Stake':'Stake per bet'} <input id="bkStake" type="number" min="1" step="10" value="${h(B.stake)}" inputmode="numeric"></label>
   <div class="bk-leg" style="border:0"><span>Total stake</span><b class="num">${money(total)}</b></div>
   <div class="bk-leg" style="border:0"><span>Potential return</span><b class="num up" id="bkRet">${money(ret)}</b></div>
   <p class="psub" style="margin:0 0 6px">Play money. Not real, can’t be cashed out.</p>
   <p class="down" id="bkErr" style="margin:4px 0 8px"${err?'':' hidden'}>${err}</p>
   <div class="row" style="margin:6px 0 0"><button class="btn" id="bkPlace" ${err?'disabled':''}>Place ${parlay||!multi?'bet':B.slip.length+' bets'}</button><button class="btn ghost" id="bkClear">Clear</button></div></div>`;
}
function floatText(){const n=B.slip.length;if(!n)return'';const par=n>1&&B.mode==='parlay';const pp=par?parlayPrice():null;
  return `Bet slip: ${n} ${n>1?'picks':'pick'}${par?(pp.impossible?', can\u2019t all win':`, parlay ${oddsTxt(pp.d)}`):''}. Review and place`}
function bkRerender(){const y=window.scrollY;render();window.scrollTo(0,y)}
function refreshSlip(){const LG=ledger();const s=$('#slip');if(s){const f=document.activeElement&&document.activeElement.id==='bkStake';s.innerHTML=rSlip(LG.bank);if(f){const i=$('#bkStake');i.focus();const v=i.value;i.value='';i.value=v}}}
document.addEventListener('click',e=>{
  if(S.tab!=='book')return;
  const o=e.target.closest('[data-leg]');if(o){const l=JSON.parse(o.dataset.leg);const k=legKey(l);const i=B.slip.findIndex(x=>legKey(x)===k);
    if(i>=0)B.slip.splice(i,1);else B.slip.push(l);B.msg='';bkRerender();return}
  const sc=e.target.closest('[data-sec]');if(sc){B.sec=sc.dataset.sec;bkRerender();return}
  const pp=e.target.closest('[data-ppos]');if(pp){B.ppos=pp.dataset.ppos;bkRerender();return}
  const rm=e.target.closest('[data-rm]');if(rm){B.slip.splice(Number(rm.dataset.rm),1);bkRerender();return}
  const bm=e.target.closest('[data-bm]');if(bm){B.mode=bm.dataset.bm;B.userMode=true;refreshSlip();return}
  const fm=e.target.closest('[data-fmt]');if(fm){B.fmt=fm.dataset.fmt;store.set('wr_oddsfmt',B.fmt);bkRerender();return}
  if(e.target.id==='bkClear'){B.slip=[];bkRerender();return}
  if(e.target.id==='bkPlace'){const stake=Math.round(Number(B.stake)||0),t=Date.now();
    const bets=(B.slip.length>1&&B.mode==='parlay'?[{id:t,stake,legs:B.slip,pd:parlayPrice().d}]:B.slip.map((l,i)=>({id:t+i,stake,legs:[l]}))).map(b=>({...b,placed:new Date().toISOString()}));
    const done=()=>{B.msg=bets.length>1?`${bets.length} bets placed.`:'Bet placed.';B.slip=[];bkRerender()};
    if(remote()){e.target.disabled=true;bkPlaceRemote(bets).then(done).catch(err=>{B.msg='';const m=$('#bkErr');if(m){m.hidden=false;m.textContent='Couldn’t save the bet: '+err.message}e.target.disabled=false})}
    else{const d=bkLoad();d.bets.push(...bets);bkSave(d);done()}
    return}
  if(e.target.id==='bkReset'){if(confirm('Clear all your bets this season and start over with $'+START_BANK+' in play money?')){
    if(remote()){ACC.sb.from('bets').delete().eq('league_id',S.leagueId).eq('season',Number(S.season)).eq('user_id',ACC.session.user.id).then(()=>{BKR.mine=null;BKR.league=null;bkRerender()})}
    else{bkSave({bank:START_BANK,bets:[]});bkRerender()}}return}
  if(e.target.id==='bkShare'){const L=ledger();const fmt=r=>{const d=r.b.pd||r.b.legs.reduce((x,l)=>x*l.d,1);const st={open:'OPEN',win:'WON',loss:'LOST',push:'PUSH'}[r.st];
      return `${st}: ${r.b.legs.length>1?r.b.legs.length+'-leg parlay: ':''}${r.b.legs.map(legLabel).join(' + ')} | ${money(r.b.stake)} at ${oddsTxt(d)}${r.st==='open'?` to return ${money(r.b.stake*d)}`:r.st==='win'?`, paid ${money(r.pay)}`:''}`};
    const txt=`${tn(S.meRid)} at the ${S.league.name} sportsbook (play money): ${money(L.bank)}, ${L.pl>=0?'+':''}${money(L.pl)} profit\n`+[...L.rows].reverse().slice(0,15).map(fmt).join('\n');
    const m=$('#bkShareMsg');navigator.clipboard?navigator.clipboard.writeText(txt).then(()=>m.textContent='Copied',()=>m.textContent='Copy blocked here'):m.textContent='Copy blocked here'}
});
document.addEventListener('change',e=>{if(e.target.id==='bkMu'){B.pmu=e.target.value;bkRerender()}if(e.target.id==='hsWeek'){HS.open=Number(e.target.value);bkRerender()}});
document.addEventListener('input',e=>{if(e.target.id==='bkStake'){B.stake=e.target.value;refreshSlip()}});
registerModule({key:'book',label:'Sportsbook',order:80,live:true,render:rBook});

document.addEventListener('wr:reset',()=>{B.slip=[];B.pmu='all';B.msg='';parlayCache={key:'',v:null}});
