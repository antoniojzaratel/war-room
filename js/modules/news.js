/* News: injury report and ESPN headlines tagged with league rosters */
function rNews(){
  const me=S.byRid[S.meRid];const names={};S.teams.forEach(t=>t.players.forEach(id=>{const p=S.P[id];if(p.pos!=='DEF')names[id]={n:p.n,t}}));
  const tagged=S.news.map(a=>{const txt=(a.headline||'')+' '+(a.description||'');const hits=Object.keys(names).filter(id=>names[id].n.length>6&&txt.includes(names[id].n));return{a,hits}});
  const inj=S.teams.flatMap(t=>t.players.filter(id=>S.P[id].inj&&(S.val[id]||0)>800).map(id=>({id,t}))).sort((a,b)=>(a.t.rid===S.meRid?-1:0)-(b.t.rid===S.meRid?-1:0)||(S.val[b.id]||0)-(S.val[a.id]||0));
  const art=({a,hits})=>{const link=a.links&&a.links.web&&a.links.web.href;const date=a.published?new Date(a.published).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'}):'';
    return `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="pname">${link?`<a href="${h(link)}" target="_blank" rel="noopener" style="color:inherit">${h(a.headline)}</a>`:h(a.headline)}</div>
    <div class="psub">${h(date)}${hits.length?' ':''}${hits.map(id=>`<span class="tag ${names[id].t.rid===S.meRid?'good':''}">${h(names[id].n)}, ${h(names[id].t.name)}</span>`).join(' ')}</div>
    ${a.description?`<p style="margin:4px 0 0">${h(a.description)}</p>`:''}</div>`};
  const mine=tagged.filter(x=>x.hits.some(id=>names[id].t.rid===S.meRid));
  return `<h2>Injury report</h2><p class="lede">Every rostered player carrying an injury designation on Sleeper, your team first.</p>
  <div class="panel scroll"><table><thead><tr><th>Player</th><th>Status</th><th>Team in league</th><th class="r">Week ${S.planWeek}</th></tr></thead><tbody>
  ${inj.map(x=>`<tr class="${x.t.rid===S.meRid?'me':''}"><td>${pcell(x.id)}</td><td>${h(S.P[x.id].inj)}${S.P[x.id].body?', '+h(S.P[x.id].body):''}</td><td>${h(x.t.name)}</td><td class="r num">${f1(wkPlan(x.id))}</td></tr>`).join('')||'<tr><td>No notable injuries.</td></tr>'}</tbody></table></div>
  ${mine.length?`<h2>About your players</h2><div class="panel">${mine.map(art).join('')}</div>`:''}
  <h2>NFL headlines</h2><div class="panel">${S.news.length?tagged.map(art).join(''):'<p class="mute">Headlines could not load.</p>'}</div>`;
}

registerModule({key:'news',label:'News',order:70,render:rNews});
