/* App shell: landing page, Google sign-in (with the backend) or Sleeper username (dev mode), linking a Sleeper account,
   league picker, tab bar, routing between modules, boot, and the screen shown when Sleeper can't be reached */
const APP=()=>CONFIG.appName||'Dynasty Room';
function tabs(){return [...MODULES].filter(m=>!m.hidden).sort((a,b)=>a.order-b.order)}
function renderChrome(){
  const L=S.league,me=S.byRid[S.meRid];
  $('#lgName').textContent=L.name;
  const inProg=Object.values(S.games).some(g=>g.state==='in');
  $('#lgMeta').innerHTML=`${inProg?'<span class="live-dot"></span>':''}Week ${S.week}, ${S.season} season. ${L.total_rosters}-team ${S.isDynasty?'dynasty':'redraft'}, ${S.slots.includes('SUPER_FLEX')?'Superflex':'1QB'}, ${(L.scoring_settings.rec??0)} PPR.${me&&S.inLeague?` You are ${h(me.name)} (${me.w}-${me.l}${me.t?'-'+me.t:''}).`:' You aren’t in this league, so you’re viewing it as a guest.'}`;
  renderAcct();
  $('#tabs').innerHTML=tabs().map(m=>`<button role="tab" aria-selected="${S.tab===m.key}" data-tab="${m.key}">${m.label}</button>`).join('');
  $('#foot').innerHTML=`${h(APP())} is not affiliated with Sleeper. Data: Sleeper (leagues, rosters, projections, dynasty ADP, scores, schedule)${(CONFIG.sources||{}).espnClock?', ESPN public scoreboard (game clocks)':''}. Values, forecasts and odds come from ${h(S.valueSource||'the Dynasty Room model')} and Monte Carlo simulation. The sportsbook uses play money only. <a href="privacy.html">Privacy</a> <a href="terms.html">Terms</a>`;
}
function planBadge(){if(ACC.mode==='dev')return '';return ACC.plan==='free'?'<span class="acct-plan">Free</span>':'<span class="acct-plan pro">Premium</span>'}
function renderAcct(){
  const lg=S.myLeagues||[];
  if(!S.username&&!ACC.session){$('#acct').innerHTML='';return}
  $('#acct').innerHTML=`${S.username?`<span class="acct-user">@${h(S.username)}</span>`:''}
    ${lg.length>1?`<select id="acctLeague" aria-label="League">${S.leagueId?'':'<option value="" selected disabled>Choose a league</option>'}${lg.map(l=>`<option value="${l.league_id}" ${l.league_id===S.leagueId?'selected':''}>${h(l.name)}</option>`).join('')}</select>`:''}
    ${planBadge()}
    ${ACC.mode==='live'?`${ACC.plan==='free'?'<button class="acct-btn acct-up" data-go="account" type="button">Upgrade</button>':''}<button class="acct-btn" data-go="account" type="button">Account</button>`:`<button class="acct-btn" id="acctSwitch" type="button">Switch user</button>`}`;
}
function render(){
  const m=MODULES.find(x=>x.key===S.tab)||tabs()[0];S.tab=m.key;
  try{$('#main').innerHTML=m.render();if(m.after)m.after()}
  catch(err){console.error(err);$('#main').innerHTML=`<div class="err"><b>${h(m.label)} hit an error.</b><p style="margin:6px 0 0">${h(err&&err.message||String(err))}</p><p class="psub" style="margin:6px 0 0">Please send this message to support. The other tabs still work.</p></div>`}
  try{history.replaceState(null,'',`?league=${encodeURIComponent(S.leagueId)}${ACC.mode==='dev'?`&user=${encodeURIComponent(S.username)}`:''}#${m.key}`)}catch(e){}
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;S.tab=b.dataset.tab;renderChrome();render();window.scrollTo(0,0)});
if(location.hash.length>1)S.tab=location.hash.slice(1);

/* ---------- landing, sign in, link Sleeper, pick a league ---------- */
function bare(title,meta){$('#lgName').textContent=title;$('#lgMeta').textContent=meta||'';$('#tabs').innerHTML='';
  $('#foot').innerHTML=`${h(APP())} is not affiliated with Sleeper. The sportsbook uses play money only. <a href="privacy.html">Privacy</a> <a href="terms.html">Terms</a>`;renderAcct()}
const FEATURES=[
  ['Live win probability','Every starter’s points, pregame projection and live projection, and your odds updating with the game clock.'],
  ['Lineups that win','The most projected points, or the lineup with the best chance to beat this week’s opponent.'],
  ['Trades, graded twice','Value today and lineup impact now and in two years, for up to four teams, plus a finder for win-win deals.'],
  ['Three-year forecasts','Title and toilet bowl odds from thousands of simulated seasons, and every roster aged forward with its draft picks.'],
  ['League history','All-time standings, records, the best players ever and a ledger that grades every trade your league has made.'],
  ['The weekly roast','A newspaper that roasts every manager from real results. And a play-money sportsbook to settle the arguments.']];
function usernameForm(msg,label){
  return `<form id="signin" class="signin-form" autocomplete="off"><label for="suUser">${label||'Sleeper username'}</label>
    <div class="row" style="margin:6px 0 0"><input id="suUser" value="${h(S.username||'')}" placeholder="e.g. antoniojzaratel" autocapitalize="none" spellcheck="false" required>
    <button class="btn" type="submit">${ACC.mode==='live'?'Link and find my leagues':'Find my leagues'}</button></div></form>
    ${msg?`<p class="down" style="margin:10px 0 0">${h(msg)}</p>`:''}`}
function showLanding(msg){
  bare(APP(),'The dynasty front office for your Sleeper leagues.');
  const cta=ACC.mode==='live'?`<button class="btn btn-google" data-signin="google"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.2 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</button>
    <p class="psub" style="margin:10px 0 0">Free to start. Then link your Sleeper username; no Sleeper password needed.</p>`:usernameForm(msg);
  $('#main').innerHTML=`<section class="hero"><div class="hero-in">
      <h2 class="hero-h">Every Sleeper league you’re in, run like a front office.</h2>
      <p class="hero-p">Live win probability, lineups built to beat this week’s opponent, trades graded now and in three years, league history and a weekly roast of everyone in it.</p>
      ${cta}</div>
      <div class="hero-board" aria-hidden="true"><div class="hb-row"><span>Your team</span><b class="num">118.4</b></div><div class="hb-row"><span>Opponent</span><b class="num">104.9</b></div>
        <div class="wp"><div class="track"><i style="width:71%"></i></div><div class="lbl"><span>71% to win</span><span>29%</span></div></div></div></section>
    <section class="feat">${FEATURES.map(([t,d])=>`<div class="feat-i"><h3>${h(t)}</h3><p>${h(d)}</p></div>`).join('')}</section>
    <h2 style="margin-top:36px">Plans</h2>${pricingBlock()}`;
  setTimeout(()=>{const i=$('#suUser');if(i&&ACC.mode==='dev')i.focus()},0);
}
function showLink(msg){
  bare(APP(),ACC.session?`Signed in as ${ACC.session.user.email}`:'');
  $('#main').innerHTML=`<section class="signin"><h2>Link your Sleeper account</h2>
    <p class="lede">Type the username under your avatar in the Sleeper app. ${h(APP())} finds every league you’re in; it only reads what Sleeper already makes public.</p>${usernameForm(msg)}</section>`;
  setTimeout(()=>{const i=$('#suUser');if(i)i.focus()},0);
}
const showSignIn=msg=>ACC.mode==='live'&&ACC.session?showLink(msg):showLanding(msg);
async function fetchLeagues(username){
  let user=null;try{user=await j(`${API}/v1/user/${encodeURIComponent(username)}`)}catch(e){if(!/^404/.test(e.message))throw e}
  if(!user||!user.user_id)return{user:null,leagues:[]};
  const st=await j(API+'/v1/state/nfl');let season=st.season;
  let leagues=(await tj(`${API}/v1/user/${user.user_id}/leagues/nfl/${season}`))||[];
  if(!leagues.length&&st.previous_season){season=st.previous_season;leagues=(await tj(`${API}/v1/user/${user.user_id}/leagues/nfl/${season}`))||[]}
  leagues.sort((a,b)=>(b.league_id===DEF_LEAGUE)-(a.league_id===DEF_LEAGUE)||a.name.localeCompare(b.name));
  return{user,leagues,season};
}
const lgDesc=l=>{const s=l.settings||{},rp=l.roster_positions||[];return `${l.total_rosters}-team ${s.type===2?'dynasty':s.type===1?'keeper':'redraft'}, ${rp.includes('SUPER_FLEX')?'Superflex':'1QB'}, ${(l.scoring_settings||{}).rec??0} PPR`};
function showPicker(){
  const lg=S.myLeagues||[];
  bare(APP(),`Signed in as @${S.username}`);
  $('#main').innerHTML=`<h2>Pick a league</h2><p class="lede">${lg.length} ${lg.length===1?'league':'leagues'} on Sleeper for @${h(S.username)}. You can switch any time from the top of the page.</p>
  <div class="lg-grid">${lg.map(l=>`<button class="lg-card" data-lg="${h(l.league_id)}">
    ${l.avatar?`<img src="https://sleepercdn.com/avatars/thumbs/${h(l.avatar)}" alt="" width="48" height="48" loading="lazy">`:'<span class="lg-ph" aria-hidden="true"></span>'}
    <span><span class="pname">${h(l.name)}</span><span class="psub" style="display:block">${h(lgDesc(l))}, ${h(l.season)}</span></span></button>`).join('')}</div>`;
}
async function signIn(username){
  username=username.trim();if(!username)return showSignIn();
  $('#main').innerHTML='<div class="status">Looking up your leagues on Sleeper…</div>';
  const r=await fetchLeagues(username);
  if(!r.user)return showSignIn(`Sleeper has no user called "${username}". Check the spelling; it's the name under your avatar in the Sleeper app.`);
  if(!r.leagues.length)return showSignIn(`@${r.user.display_name||username} isn't in any NFL leagues this season.`);
  S.username=r.user.display_name||username;S.myLeagues=r.leagues;store.set('wr_user',S.username);
  if(ACC.mode==='live'&&(ACC.profile||{}).sleeper_user_id!==r.user.user_id)await accSave({sleeper_username:S.username,sleeper_user_id:r.user.user_id});
  if(S.leagueId&&r.leagues.some(l=>l.league_id===S.leagueId))return openLeague(S.leagueId);
  if(r.leagues.length===1)return openLeague(r.leagues[0].league_id);
  S.leagueId='';showPicker();
}
async function openLeague(id){
  S.leagueId=id;store.set('wr_league',id);
  if(ACC.mode==='live'&&(ACC.profile||{}).default_league_id!==id)accSave({default_league_id:id});
  try{await load()}catch(e){console.error(e);showBlocked(e)}
  if(qs.get('checkout')==='success')afterCheckout();
}
async function afterCheckout(){
  for(let i=0;i<8&&ACC.plan==='free';i++){await new Promise(r=>setTimeout(r,2000));await accRefresh()}
  try{history.replaceState(null,'',location.pathname+`?league=${S.leagueId}#${S.tab}`)}catch(e){}
  renderChrome();render();
  const t=document.createElement('div');t.className='toast';t.textContent=ACC.plan==='free'?'Payment received. Premium turns on in a minute; reload if it doesn’t.':'Welcome to Premium. Everything is unlocked.';document.body.appendChild(t);setTimeout(()=>t.remove(),6000);
}
document.addEventListener('submit',e=>{if(e.target.id==='signin'){e.preventDefault();boot(()=>signIn($('#suUser').value))}});
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-lg]');if(c){boot(()=>openLeague(c.dataset.lg));return}
  if(e.target.id==='acctSwitch'){S.username='';S.leagueId='';S.myLeagues=null;store.set('wr_user','');store.set('wr_league','');clearInterval(liveTimer);showSignIn()}
});
document.addEventListener('change',e=>{if(e.target.id==='acctLeague')boot(()=>openLeague(e.target.value))});

/* ---------- when Sleeper can't be reached ---------- */
function showBlocked(err){
  const inClaude=/claude\.ai|claudeusercontent/.test(location.hostname)||location.protocol==='blob:'||window.top!==window.self;
  bare(APP(),'Could not reach Sleeper');
  $('#main').innerHTML=`<div class="err"><b>${inClaude?'This preview can’t load live data.':'Sleeper didn’t respond.'}</b>
    <p style="margin:6px 0 0">${inClaude?`Pages shown inside claude.ai aren’t allowed to call Sleeper or other outside sites. The full ${h(APP())} runs at ${h(CONFIG.siteUrl)}.`:h(err&&err.message||'The request failed.')+' Check your connection, then reload the page.'}</p>
    ${inClaude&&CONFIG.siteUrl?`<p style="margin:12px 0 0"><a class="btn" href="${h(CONFIG.siteUrl)}" target="_blank" rel="noopener">Open ${h(APP())}</a></p>`:''}</div>`;
}

/* ---------- boot ---------- */
async function boot(step){
  try{
    if(!ACC.ready)await accInit();
    if(step)return await step();
    if(ACC.mode==='live'){
      if(!ACC.session)return showLanding();
      const pr=ACC.profile||{};S.username=pr.sleeper_username||'';
      if(!qs.get('league')&&pr.default_league_id)S.leagueId=pr.default_league_id;
      if(!S.username)return showLink();
      if(S.tab==='account'&&!S.leagueId)return renderAccountOnly();
      return await signIn(S.username);
    }
    if(!S.username)return showLanding();
    await signIn(S.username);
  }catch(e){console.error(e);showBlocked(e)}
}
boot();
