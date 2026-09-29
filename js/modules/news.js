/* News: injury report, what the whole Sleeper community is adding and dropping, and (optionally) ESPN headlines */
const NW={drops:null};
function rNews(){
  const names={};S.teams.forEach(t=>t.players.forEach(id=>{const p=S.P[id];if(p)names[id]={n:p.n,t}}));
  const inj=S.teams.flatMap(t=>t.players.filter(id=>S.P[id].inj&&(S.val[id]||0)>800).map(id=>({id,t}))).sort((a,b)=>(a.t.rid===S.meRid?-1:0)-(b.t.rid===S.meRid?-1:0)||(S.val[b.id]||0)-(S.val[a.id]||0));
  if(NW.drops===null){NW.drops=[];tj(`${API}/v1/players/nfl/trending/drop?lookback_hours=48&limit=40`).then(d=>{NW.drops=d||[];if(S.tab==='news')render()})}
  const owner=id=>names[id]?`<span class="tag ${names[id].t.rid===S.meRid?'good':''}">${h(names[id].t.name)}</span>`:'<span class="tag">Free agent here</span>';
  const buzz=(list,verb)=>list.filter(x=>S.P[x.player_id]).slice(0,15).map(x=>`<tr><td>${pcell(x.player_id)}</td><td>${owner(x.player_id)}</td><td class="r num">${f0(x.count)}</td><td class="r num">${f1(ros(x.player_id))}</td></tr>`).join('')||`<tr><td class="mute">Nothing yet.</td></tr>`;
  let heads='';
  if((CONFIG.sources||{}).espnNews&&S.news&&S.news.length){
    const tagged=S.news.map(a=>{const txt=(a.headline||'')+' '+(a.description||'');return{a,hits:Object.keys(names).filter(id=>names[id].n.length>6&&txt.includes(names[id].n))}});
    heads=`<h2>NFL headlines</h2><div class="panel">${tagged.map(({a,hits})=>{const link=a.links&&a.links.web&&a.links.web.href;
      return `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="pname">${link?`<a href="${h(link)}" target="_blank" rel="noopener" style="color:inherit">${h(a.headline)}</a>`:h(a.headline)}</div><div class="psub">${hits.map(id=>`<span class="tag ${names[id].t.rid===S.meRid?'good':''}">${h(names[id].n)}, ${h(names[id].t.name)}</span>`).join(' ')}</div></div>`}).join('')}</div>`;
  }
  return `<h2>Injury report</h2><p class="lede">Every rostered player carrying an injury designation on Sleeper, your team first.</p>
  <div class="panel scroll"><table><thead><tr><th>Player</th><th>Status</th><th>Team in league</th><th class="r">Week ${S.planWeek}</th></tr></thead><tbody>
  ${inj.map(x=>`<tr class="${x.t.rid===S.meRid?'me':''}"><td>${pcell(x.id)}</td><td>${h(S.P[x.id].inj)}${S.P[x.id].body?', '+h(S.P[x.id].body):''}</td><td>${h(x.t.name)}</td><td class="r num">${f1(wkPlan(x.id))}</td></tr>`).join('')||'<tr><td>No notable injuries.</td></tr>'}</tbody></table></div>
  <h2>Buzz across Sleeper</h2><p class="lede">What managers in every Sleeper league added and dropped in the last 48 hours, and who has each player in yours.</p>
  <div class="grid2"><div class="panel scroll"><h3 style="margin-top:0">Most added</h3><table><thead><tr><th>Player</th><th>Here</th><th class="r">Adds</th><th class="r">Next 4 avg</th></tr></thead><tbody>${buzz(S.trend||[],'added')}</tbody></table></div>
  <div class="panel scroll"><h3 style="margin-top:0">Most dropped</h3><table><thead><tr><th>Player</th><th>Here</th><th class="r">Drops</th><th class="r">Next 4 avg</th></tr></thead><tbody>${buzz(NW.drops||[],'dropped')}</tbody></table></div></div>
  ${heads}`;
}
document.addEventListener('wr:reset',()=>{NW.drops=null});
registerModule({key:'news',label:'News',order:70,render:rNews});
