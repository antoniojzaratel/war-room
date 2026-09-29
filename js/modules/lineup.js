/* Lineup: optimal lineup vs current starters */
function currentVsOptimal(t,fn){
  const cur=S.slots.map((s,i)=>({slot:s,id:t.starters[i]&&t.starters[i]!=='0'?t.starters[i]:null}));
  const fixed=new Set();const out=cur.map(c=>({slot:c.slot,id:null}));
  cur.forEach((c,i)=>{if(c.id&&isLocked(c.id)){out[i].id=c.id;out[i].locked=true;fixed.add(c.id)}});
  const pool=startable(t).filter(id=>!fixed.has(id)&&!isLocked(id)).map(id=>({id,pos:S.P[id].pos,pts:fn(id)})).sort((a,b)=>b.pts-a.pts);
  const used=new Set();
  const order=out.map((o,i)=>i).filter(i=>!out[i].id).sort((a,b)=>ORD.indexOf(out[a].slot)-ORD.indexOf(out[b].slot));
  for(const i of order){const c=pool.find(p=>!used.has(p.id)&&ELIG[out[i].slot].includes(p.pos));if(c){used.add(c.id);out[i].id=c.id}}
  const tot=a=>a.reduce((s,x)=>s+(x.id?fn(x.id):0),0);
  return{cur,opt:out,curT:tot(cur),optT:tot(out)};
}
function rLineup(){
  const t=S.byRid[S.lineupTeam],fn=S.lineupMode==='week'?wk:ros;const r=currentVsOptimal(t,fn);
  const gain=r.optT-r.curT;const curSet=new Set(r.cur.map(x=>x.id)),optSet=new Set(r.opt.map(x=>x.id));
  const ins=[...optSet].filter(id=>id&&!curSet.has(id)),outs=[...curSet].filter(id=>id&&!optSet.has(id));
  const bench=startable(t).filter(id=>!optSet.has(id)).sort((a,b)=>fn(b)-fn(a));
  const opts=S.teams.map(x=>`<option value="${x.rid}" ${x.rid===t.rid?'selected':''}>${h(x.name)}${x.rid===S.meRid?' (you)':''}</option>`).join('');
  return `<h2>Optimal lineup</h2><p class="lede">Built from Sleeper projections scored with your league's exact settings. Players whose games already kicked off stay locked where they are.</p>
  <div class="row"><select id="luTeam" aria-label="Team">${opts}</select>
    <div class="chips" role="group" aria-label="Horizon"><button class="chip" data-lm="week" aria-pressed="${S.lineupMode==='week'}">Week ${S.week}</button><button class="chip" data-lm="ros" aria-pressed="${S.lineupMode==='ros'}">Next 4 weeks</button></div></div>
  <div class="panel" style="margin-bottom:16px">${gain>.05?`<div class="verdict up">+${f1(gain)} points available</div><p style="margin:6px 0 0">${ins.map((id,i)=>`Start <b>${h(S.P[id].n)}</b> (${f1(fn(id))})${outs[i]?` over <b>${h(S.P[outs[i]].n)}</b> (${f1(fn(outs[i]))})`:''}`).join('. ')}.</p>`:
    `<div class="verdict">This lineup is already optimal</div><p class="mute" style="margin:6px 0 0">Projected ${f1(r.curT)} points.</p>`}</div>
  <div class="grid2">
   <div class="panel"><h3 style="margin-top:0">Current starters, ${f1(r.curT)}</h3>${luTable(r.cur,fn)}</div>
   <div class="panel"><h3 style="margin-top:0">Optimal, ${f1(r.optT)}</h3>${luTable(r.opt,fn)}</div>
  </div>
  <h3>Bench</h3><div class="panel scroll"><table><thead><tr><th>Player</th><th class="r">Proj</th><th class="r">Next 4 avg</th><th class="r">Value</th></tr></thead><tbody>
  ${bench.map(id=>`<tr><td>${pcell(id)}</td><td class="r num">${f1(wk(id))}</td><td class="r num">${f1(ros(id))}</td><td class="r num">${f0(S.val[id])}</td></tr>`).join('')}</tbody></table></div>`;
}
function luTable(arr,fn){return `<div class="scroll"><table><tbody>${arr.map(x=>`<tr><td>${posTag(x.slot)}</td><td>${x.id?pcell(x.id):'<span class="flag">Empty</span>'}${x.locked?' <span class="tag">Locked</span>':''}</td><td class="r num" style="font-size:18px">${x.id?f1(fn(x.id)):'0.0'}</td></tr>`).join('')}</tbody></table></div>`}
document.addEventListener('change',e=>{if(e.target.id==='luTeam'){S.lineupTeam=Number(e.target.value);render()}});
document.addEventListener('click',e=>{const lm=e.target.closest('[data-lm]');if(lm){S.lineupMode=lm.dataset.lm;render()}});
registerModule({key:'lineup',label:'Lineup',order:20,live:true,render:rLineup});
