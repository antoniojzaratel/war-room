/* App shell: sign-in with a Sleeper username, league picker, tab bar, routing between modules, boot,
   and the screen shown when Sleeper can't be reached */
function tabs(){return [...MODULES].sort((a,b)=>a.order-b.order)}
function renderChrome(){
  const L=S.league,me=S.byRid[S.meRid];
  $('#lgName').textContent=L.name;
  const inProg=Object.values(S.games).some(g=>g.state==='in');
  $('#lgMeta').innerHTML=`${inProg?'<span class="live-dot"></span>':''}Week ${S.week}, ${S.season} season. ${L.total_rosters}-team ${S.isDynasty?'dynasty':'redraft'}, ${S.slots.includes('SUPER_FLEX')?'Superflex':'1QB'}, ${(L.scoring_settings.rec??0)} PPR.${me&&S.inLeague?` You are ${h(me.name)} (${me.w}-${me.l}${me.t?'-'+me.t:''}).`:' You aren’t in this league, so you’re viewing it as a guest.'}`;
  renderAcct();
  $('#tabs').innerHTML=tabs().map(m=>`<button role="tab" aria-selected="${S.tab===m.key}" data-tab="${m.key}">${m.label}</button>`).join('');
  $('#foot').innerHTML=`Data: Sleeper API (league, rosters, projections, live points), ESPN (game clocks, headlines), ${h(S.valueSource)}. ${S.projOK?'':'Sleeper projections did not load, so projections read as zero. '}Live numbers refresh every 60 seconds while games are on.`;
}
function renderAcct(){
  const lg=S.myLeagues||[];
  $('#acct').innerHTML=S.username?`<span class="acct-user">@${h(S.username)}</span>
    ${lg.length>1?`<select id="acctLeague" aria-label="League">${S.leagueId?'':'<option value="" selected disabled>Choose a league</option>'}${lg.map(l=>`<option value="${l.league_id}" ${l.league_id===S.leagueId?'selected':''}>${h(l.name)}</option>`).join('')}</select>`:''}
    <button class="acct-btn" id="acctSwitch" type="button">Switch user</button>`:'';
}
function render(){
  const m=MODULES.find(x=>x.key===S.tab)||tabs()[0];S.tab=m.key;
  try{$('#main').innerHTML=m.render();if(m.after)m.after()}
  catch(err){console.error(err);$('#main').innerHTML=`<div class="err"><b>${h(m.label)} hit an error.</b><p style="margin:6px 0 0">${h(err&&err.message||String(err))}</p><p class="psub" style="margin:6px 0 0">Send this message to whoever runs War Room. The other tabs still work.</p></div>`}
  try{history.replaceState(null,'',`?user=${encodeURIComponent(S.username)}&league=${encodeURIComponent(S.leagueId)}#${m.key}`)}catch(e){}
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;S.tab=b.dataset.tab;renderChrome();render();window.scrollTo(0,0)});
if(location.hash.length>1)S.tab=location.hash.slice(1);

/* ---------- sign in and pick a league ---------- */
function bare(title,meta){$('#lgName').textContent=title;$('#lgMeta').textContent=meta||'';$('#tabs').innerHTML='';$('#foot').textContent='';renderAcct()}
function showSignIn(msg){
  bare('War Room','Live projections, rankings, trades, forecasts, a sportsbook and a weekly roast for your Sleeper league.');
  $('#main').innerHTML=`<section class="signin">
    <h2>Sign in with your Sleeper username</h2>
    <p class="lede">War Room finds every league you're in this season. No password: it only reads what Sleeper already makes public.</p>
    <form id="signin" class="signin-form" autocomplete="off"><label for="suUser">Sleeper username</label>
      <div class="row" style="margin:6px 0 0"><input id="suUser" value="${h(S.username||'')}" placeholder="e.g. antoniojzaratel" autocapitalize="none" spellcheck="false" required>
      <button class="btn" type="submit">Find my leagues</button></div></form>
    ${msg?`<p class="down" style="margin:10px 0 0">${h(msg)}</p>`:''}
  </section>`;
  setTimeout(()=>{const i=$('#suUser');if(i)i.focus()},0);
}
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
  bare('War Room',`Signed in as @${S.username}`);
  $('#main').innerHTML=`<h2>Pick a league</h2><p class="lede">${lg.length} ${lg.length===1?'league':'leagues'} on Sleeper for @${h(S.username)}. You can switch any time from the top of the page.</p>
  <div class="lg-grid">${lg.map(l=>`<button class="lg-card" data-lg="${h(l.league_id)}">
    ${l.avatar?`<img src="https://sleepercdn.com/avatars/thumbs/${h(l.avatar)}" alt="" width="48" height="48" loading="lazy">`:'<span class="lg-ph" aria-hidden="true"></span>'}
    <span><span class="pname">${h(l.name)}</span>${l.league_id===DEF_LEAGUE?' <span class="tag good">War Room league</span>':''}<span class="psub" style="display:block">${h(lgDesc(l))}, ${h(l.season)}</span></span></button>`).join('')}</div>`;
}
async function signIn(username){
  username=username.trim();if(!username)return showSignIn();
  $('#main').innerHTML='<div class="status">Looking up your leagues on Sleeper…</div>';
  const r=await fetchLeagues(username);
  if(!r.user)return showSignIn(`Sleeper has no user called "${username}". Check the spelling; it's the name under your avatar in the Sleeper app.`);
  if(!r.leagues.length)return showSignIn(`@${r.user.display_name||username} isn't in any NFL leagues this season.`);
  S.username=r.user.display_name||username;S.myLeagues=r.leagues;store.set('wr_user',S.username);
  if(S.leagueId&&r.leagues.some(l=>l.league_id===S.leagueId))return openLeague(S.leagueId);
  if(r.leagues.length===1)return openLeague(r.leagues[0].league_id);
  S.leagueId='';showPicker();
}
async function openLeague(id){
  S.leagueId=id;store.set('wr_league',id);
  try{await load()}catch(e){console.error(e);showBlocked(e)}
}
document.addEventListener('submit',e=>{if(e.target.id==='signin'){e.preventDefault();boot(()=>signIn($('#suUser').value))}});
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-lg]');if(c){boot(()=>openLeague(c.dataset.lg));return}
  if(e.target.id==='acctSwitch'){S.username='';S.leagueId='';S.myLeagues=null;store.set('wr_user','');store.set('wr_league','');clearInterval(liveTimer);showSignIn()}
});
document.addEventListener('change',e=>{if(e.target.id==='acctLeague')boot(()=>openLeague(e.target.value))});

/* ---------- when Sleeper can't be reached ---------- */
const SNAP=[["ZaraTDs","antoniojzaratel",9.4,23.8,94],["Colageno Special Team","FerCantu2001",8.6,18.5,92],["Glock Purdy","legargamer",8.4,15.7,89],["Turgers💍","Furber",8.2,16.8,91],["Juanimales (grr)","juanfrangzz",7.6,7.4,69],["Le Noide’s Equipe 🚬","HumbertoMena17",6.6,6.9,64],["UÑITAS 💅","andresguerecag",6.2,2.1,19],["Hock-Tua Fc","DiegoPedraza",6.1,3.6,34],["FM7","federicomedina72",4.8,2.9,27],["LALOCOMOTORA 🚂","Lalocomotora21",3.7,2.4,22]];
function showBlocked(err){
  const inClaude=/claude\.ai|claudeusercontent/.test(location.hostname)||location.protocol==='blob:'||window.top!==window.self;
  bare('War Room','Could not reach Sleeper');
  const site=CONFIG.siteUrl||'';
  $('#main').innerHTML=`<div class="err"><b>${inClaude?'This preview can’t load live data.':'Sleeper didn’t respond.'}</b>
    <p style="margin:6px 0 0">${inClaude?'Pages shown inside claude.ai aren’t allowed to call Sleeper, ESPN or other outside sites. The full War Room, with live scores, every tool and the sportsbook, runs on the GitHub Pages site.':h(err&&err.message||'The request failed.')+' Check your connection, then reload the page.'}</p>
    ${site?`<p style="margin:12px 0 0"><a class="btn" href="${h(site)}" target="_blank" rel="noopener">Open the live War Room</a></p>`:''}</div>
  ${inClaude||S.leagueId===DEF_LEAGUE?`<h2>La Dinastía, snapshot from September 25, 2026</h2><p class="lede">Three-season average projected wins and title odds from The Dynasty Terminal model.</p>
  <div class="panel scroll"><table><thead><tr><th>#</th><th>Team</th><th class="r">Avg wins</th><th class="r">Title odds</th><th class="r">Playoffs</th></tr></thead><tbody>
  ${SNAP.map((r,i)=>`<tr class="${r[1]===DEF_USER?'me':''}"><td class="num">${i+1}</td><td><div class="pname">${h(r[0])}</div><div class="psub">@${h(r[1])}</div></td><td class="r num">${r[2]}</td><td class="r num">${r[3]}%</td><td class="r num">${r[4]}%</td></tr>`).join('')}</tbody></table></div>`:''}`;
}

/* ---------- boot ---------- */
async function boot(step){
  try{
    if(step)return await step();
    if(!S.username)return showSignIn();
    await signIn(S.username);
  }catch(e){console.error(e);showBlocked(e)}
}
boot();
