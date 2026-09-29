/* Waivers: free agents, trending adds, drop candidates */
function rWire(){
  const rostered=new Set();S.teams.forEach(t=>t.players.forEach(id=>rostered.add(id)));
  const used=new Set(S.slots.flatMap(s=>ELIG[s]));const trend={};S.trend.forEach(x=>trend[x.player_id]=x.count);
  let fa=Object.keys(S.P).filter(id=>{const p=S.P[id];return p.team&&p.active&&used.has(p.pos)&&!rostered.has(id)&&(ros(id)>0||trend[id])});
  if(S.wvPos!=='ALL')fa=fa.filter(id=>S.P[id].pos===S.wvPos);
  fa.sort((a,b)=>ros(b)-ros(a));fa=fa.slice(0,30);
  const me=S.byRid[S.meRid];const lu=optimize(startable(me),ros);
  const worst={};lu.lineup.forEach(x=>{if(!x.id)return;const p=x.pos;if(worst[p]==null||x.pts<worst[p])worst[p]=x.pts});
  const drops=me.players.filter(id=>!lu.lineup.some(x=>x.id===id)).sort((a,b)=>(S.val[a]||0)-(S.val[b]||0)).slice(0,5);
  const chips=['ALL',...POS.filter(p=>used.has(p))].map(p=>`<button class="chip" data-wp="${p}" aria-pressed="${S.wvPos===p}">${p==='ALL'?'All':p}</button>`).join('');
  return `<h2>Waiver wire</h2><p class="lede">Unrostered players in your league ranked by projected points over the next four weeks. The trend column is how many Sleeper leagues added them in the last 48 hours.</p>
  <div class="row chips">${chips}</div>
  <div class="panel scroll"><table><thead><tr><th>Player</th><th class="r">This week</th><th class="r">Next 4 avg</th><th class="r">Adds, 48h</th><th class="r">Value</th><th>For you</th></tr></thead><tbody>
  ${fa.map(id=>{const p=S.P[id],up=worst[p.pos]!=null&&ros(id)>worst[p.pos];return `<tr><td>${pcell(id)}</td><td class="r num">${f1(wk(id))}</td><td class="r num">${f1(ros(id))}</td><td class="r num">${trend[id]?f0(trend[id]):''}</td><td class="r num">${f0(S.val[id])}</td><td>${up?`<span class="tag good">Beats your ${p.pos} starter</span>`:''}</td></tr>`}).join('')}
  </tbody></table></div>
  <h3>Your drop candidates</h3><div class="panel scroll"><table><tbody>${drops.map(id=>`<tr><td>${pcell(id)}</td><td class="r num">${f1(ros(id))} per week</td><td class="r num">${f0(S.val[id])} value</td></tr>`).join('')}</tbody></table></div>`;
}

document.addEventListener('click',e=>{const wp=e.target.closest('[data-wp]');if(wp){S.wvPos=wp.dataset.wp;render()}});
registerModule({key:'wire',label:'Waivers',order:60,render:rWire});
