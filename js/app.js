/* App shell: tab bar, routing between modules, boot, and the screen shown when Sleeper can't be reached */
function tabs(){return [...MODULES].sort((a,b)=>a.order-b.order)}
function renderChrome(){
  const L=S.league,me=S.byRid[S.meRid];
  $('#lgName').textContent=L.name;
  const inProg=Object.values(S.games).some(g=>g.state==='in');
  $('#lgMeta').innerHTML=`${inProg?'<span class="live-dot"></span>':''}Week ${S.week}, ${S.season} season. ${L.total_rosters}-team ${S.isDynasty?'dynasty':'redraft'}, ${S.slots.includes('SUPER_FLEX')?'Superflex':'1QB'}, ${(L.scoring_settings.rec??0)} PPR. Viewing as ${h(me.name)} (${me.w}-${me.l}${me.t?'-'+me.t:''}).`;
  $('#tabs').innerHTML=tabs().map(m=>`<button role="tab" aria-selected="${S.tab===m.key}" data-tab="${m.key}">${m.label}</button>`).join('');
  $('#foot').innerHTML=`Data: Sleeper API (league, rosters, projections, live points), ESPN (game clocks, headlines), ${h(S.valueSource)}. ${S.projOK?'':'Sleeper projections did not load, so projections read as zero. '}Live numbers refresh every 60 seconds while games are on.`;
}
function render(){
  const m=MODULES.find(x=>x.key===S.tab)||tabs()[0];S.tab=m.key;
  $('#main').innerHTML=m.render();if(m.after)m.after();
  try{history.replaceState(null,'','#'+m.key)}catch(e){}
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;S.tab=b.dataset.tab;renderChrome();render();window.scrollTo(0,0)});
if(location.hash.length>1)S.tab=location.hash.slice(1);

const SNAP=[["ZaraTDs","antoniojzaratel",9.4,23.8,94],["Colageno Special Team","FerCantu2001",8.6,18.5,92],["Glock Purdy","legargamer",8.4,15.7,89],["Turgers💍","Furber",8.2,16.8,91],["Juanimales (grr)","juanfrangzz",7.6,7.4,69],["Le Noide’s Equipe 🚬","HumbertoMena17",6.6,6.9,64],["UÑITAS 💅","andresguerecag",6.2,2.1,19],["Hock-Tua Fc","DiegoPedraza",6.1,3.6,34],["FM7","federicomedina72",4.8,2.9,27],["LALOCOMOTORA 🚂","Lalocomotora21",3.7,2.4,22]];
function showBlocked(err){
  const inClaude=/claude\.ai|claudeusercontent/.test(location.hostname)||location.protocol==='blob:'||window.top!==window.self;
  $('#lgName').textContent='War Room';$('#lgMeta').textContent='Could not reach Sleeper';$('#tabs').innerHTML='';
  const site=CONFIG.siteUrl?`${CONFIG.siteUrl}?league=${encodeURIComponent(S.leagueId)}`:'';
  $('#main').innerHTML=`<div class="err"><b>${inClaude?'This preview can’t load live data.':'Sleeper didn’t respond.'}</b>
    <p style="margin:6px 0 0">${inClaude?'Pages shown inside claude.ai aren’t allowed to call Sleeper, ESPN or other outside sites. The full War Room, with live scores, every tool and the sportsbook, runs on the league’s GitHub Pages site.':h(err&&err.message||'The request failed.')+' Check your connection and the league ID, then load again.'}</p>
    ${site?`<p style="margin:12px 0 0"><a class="btn" href="${h(site)}" target="_blank" rel="noopener">Open the live War Room</a></p>`:''}</div>
  ${S.leagueId===DEF_LEAGUE?`<h2>La Dinastía, snapshot from September 25, 2026</h2><p class="lede">Three-season average projected wins and title odds from The Dynasty Terminal model.</p>
  <div class="panel scroll"><table><thead><tr><th>#</th><th>Team</th><th class="r">Avg wins</th><th class="r">Title odds</th><th class="r">Playoffs</th></tr></thead><tbody>
  ${SNAP.map((r,i)=>`<tr class="${r[1]===DEF_USER?'me':''}"><td class="num">${i+1}</td><td><div class="pname">${h(r[0])}</div><div class="psub">@${h(r[1])}</div></td><td class="r num">${r[2]}</td><td class="r num">${r[3]}%</td><td class="r num">${r[4]}%</td></tr>`).join('')}</tbody></table></div>`:''}`;
}

$('#inLeague').value=S.leagueId;$('#inUser').value=S.username;
$('#setup').addEventListener('submit',()=>{S.leagueId=$('#inLeague').value.trim()||DEF_LEAGUE;S.username=$('#inUser').value.trim()||DEF_USER;store.set('wr_league',S.leagueId);store.set('wr_user',S.username);boot()});
async function boot(){try{await load()}catch(e){console.error(e);showBlocked(e)}}
boot();
