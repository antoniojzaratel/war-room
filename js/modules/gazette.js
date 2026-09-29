/* Gazette: El Pasquín, the weekly roast newspaper built from real results */
function weekFacts(w){
  const mu=S.mu[w];if(!mu||!mu.some(m=>m.points>0))return null;
  const T={};mu.forEach(m=>{const t=S.byRid[m.roster_id];if(!t)return;const pp=m.players_points||{};
    const st=(m.starters||[]).filter(id=>id&&id!=='0'&&S.P[id]);const pl=(m.players||[]).filter(id=>S.P[id]);
    const opt=optimize(pl,id=>pp[id]||0).total;const sorted=st.map(id=>({id,p:pp[id]||0})).sort((a,b)=>b.p-a.p);
    const benchStar=pl.filter(id=>!st.includes(id)).map(id=>({id,p:pp[id]||0})).sort((a,b)=>b.p-a.p)[0];
    T[m.roster_id]={t,pts:m.points||0,opt,bench:Math.max(0,opt-(m.points||0)),star:sorted[0],dud:sorted[sorted.length-1],benchStar}});
  const games=pairsOf(mu).map(([a,b])=>{const A=T[a.roster_id],B=T[b.roster_id];const W=A.pts>=B.pts?A:B,L=W===A?B:A;W.won=true;L.won=false;W.opp=L;L.opp=W;W.margin=L.margin=W.pts-L.pts;return{W,L,m:W.pts-L.pts}});
  // records through this week
  const rec={};S.teams.forEach(t=>rec[t.rid]={w:0,l:0});
  for(let x=1;x<=w;x++)pairsOf(S.mu[x]).forEach(([a,b])=>{if(!(a.points||b.points))return;const wn=a.points>=b.points?a:b,ls=wn===a?b:a;rec[wn.roster_id].w++;rec[ls.roster_id].l++});
  const all=Object.values(T);all.forEach(x=>{x.rec=rec[x.t.rid];x.beat=all.filter(o=>o!==x&&x.pts>o.pts).length});
  const byPts=[...all].sort((a,b)=>b.pts-a.pts);const med=(byPts[Math.floor(all.length/2)-1].pts+byPts[Math.floor(all.length/2)].pts)/2;
  const tx=S.tx[w]||[];const trades=tx.filter(x=>x.type==='trade');const adds={};tx.filter(x=>x.type!=='trade').forEach(x=>(x.roster_ids||[]).forEach(r=>adds[r]=(adds[r]||0)+Object.keys(x.adds||{}).length));
  const byG=[...games].sort((a,b)=>b.m-a.m);
  return{w,all,games,top:byPts[0],low:byPts[byPts.length-1],blow:byG[0],close:byG[byG.length-1],med,
    benchKing:[...all].sort((a,b)=>b.bench-a.bench)[0],lucky:[...all].filter(x=>x.won&&x.pts<med).sort((a,b)=>a.pts-b.pts)[0],
    unlucky:[...all].filter(x=>!x.won&&x.pts>med).sort((a,b)=>b.pts-a.pts)[0],trades,adds,
    grinder:Object.entries(adds).sort((a,b)=>b[1]-a[1])[0],standings:[...S.teams].map(t=>({t,...rec[t.rid]})).sort((a,b)=>b.w-a.w||a.l-b.l)};
}
const nm=id=>S.P[id]?S.P[id].n:'?';
const LINES={
 es:{
  head:[f=>`${f.top.t.name} mete ${f1(f.top.pts)} y deja a la liga pidiendo esquina`,f=>`Masacre dominical: ${f.top.t.name} firma ${f1(f.top.pts)} y nadie lo detiene`,f=>`${f.top.t.name} se viste de gala con ${f1(f.top.pts)}; el resto, de luto`],
  deck:[f=>`Mientras tanto, ${f.low.t.name} hizo ${f1(f.low.pts)} y ya hay quien pide intervención de Protección Civil. Esto y más en la edición de la semana ${f.w}.`,f=>`En el sótano, ${f.low.t.name} (${f1(f.low.pts)}) sigue demostrando que tener roster no es lo mismo que tener equipo.`],
  low:[f=>`Con ${f1(f.low.pts)} puntos, ${f.low.t.name} se consolida como el alivio semanal de sus rivales. Fuentes cercanas al equipo confirman que el roster está en huelga desde agosto.`,f=>`${f.low.t.name} terminó con ${f1(f.low.pts)}. Ni revisando el VAR se encuentran más puntos.`],
  blow:f=>`${f.blow.W.t.name} le pasó por encima a ${f.blow.L.t.name}, ${f1(f.blow.W.pts)} a ${f1(f.blow.L.pts)}. Una diferencia de ${f1(f.blow.m)} puntos que ya fue reportada a derechos humanos.`,
  close:f=>`${f.close.W.t.name} venció a ${f.close.L.t.name} por apenas ${f1(f.close.m)} puntos. Los cardiólogos de la liga siguen de guardia.`,
  bench:f=>`${f.benchKing.t.name} dejó ${f1(f.benchKing.bench)} puntos pudriéndose en la banca${f.benchKing.benchStar?`, incluyendo los ${f1(f.benchKing.benchStar.p)} de ${nm(f.benchKing.benchStar.id)}`:''}. Se busca director técnico; informes con el comisionado.`,
  lucky:f=>`${f.lucky.t.name} ganó con apenas ${f1(f.lucky.pts)}. Ni él lo cree, pero la W cuenta igual.`,
  unlucky:f=>`${f.unlucky.t.name} hizo ${f1(f.unlucky.pts)}, más que ${f.unlucky.beat} equipos, y aun así perdió. El fantasy no es justo, y nadie dijo que lo fuera.`,
  trade:(a,b)=>`Movimiento en la mesa: ${a} y ${b} cerraron un trade. En diciembre sabremos quién llora.`,
  grind:(t,n)=>`${t} hizo ${n} movimientos en el waiver. Hiperactividad o pánico, usted decida.`,
  cap:{
   winBig:[x=>`Paliza cómoda a ${x.opp.t.name} por ${f1(x.margin)}.`,x=>`Le dio una clase gratis a ${x.opp.t.name}, ganando por ${f1(x.margin)}.`],
   winClose:[x=>`Sobrevivió a ${x.opp.t.name} por ${f1(x.margin)}, con más suerte que talento.`,x=>`Le ganó a ${x.opp.t.name} por un pelo: ${f1(x.margin)} puntos.`],
   loseBig:[x=>`${x.opp.t.name} lo mandó a la lona por ${f1(x.margin)}.`,x=>`Perdió por ${f1(x.margin)} contra ${x.opp.t.name}. Hubo partidos más parejos en la liga del parque.`],
   loseClose:[x=>`Cayó por ${f1(x.margin)} contra ${x.opp.t.name}. Tan cerca y tan lejos.`,x=>`Perdió por ${f1(x.margin)}: cualquier suplente decente lo habría salvado.`],
   star:[x=>`${nm(x.star.id)} cargó con ${f1(x.star.p)} puntos.`,x=>`El MVP fue ${nm(x.star.id)} con ${f1(x.star.p)}.`],
   dud:[x=>`${nm(x.dud.id)} aportó ${f1(x.dud.p)}, lo cual ya es mucho decir.`,x=>`${nm(x.dud.id)} (${f1(x.dud.p)}) jugó como si le debieran la quincena.`],
   bench:x=>`Dejó ${f1(x.bench)} puntos en la banca.`,
   rec:x=>x.rec.l===0?`Va ${x.rec.w}-0, invicto y cada vez más insoportable.`:x.rec.w===0?`Va 0-${x.rec.l} y sigue buscando su primera W, como quien busca estacionamiento en San Pedro un sábado.`:`Récord de ${x.rec.w}-${x.rec.l}.`},
  s:{of:'de',live:'En vivo',best:'El mejor de la semana',worst:'El sótano',blow:'Masacre',close:'Infarto',bench:'El director técnico',lucky:'Robo a mano armada',unlucky:'La injusticia',moves:'Mercado',caps:'Equipo por equipo',stand:'Tabla',week:'Semana',edition:'Edición'}},
 en:{
  head:[f=>`${f.top.t.name} drops ${f1(f.top.pts)} and the league asks for mercy`,f=>`Sunday massacre: ${f.top.t.name} posts ${f1(f.top.pts)} and nobody can stop it`,f=>`${f.top.t.name} dresses up for ${f1(f.top.pts)}; everyone else wears black`],
  deck:[f=>`Meanwhile ${f.low.t.name} put up ${f1(f.low.pts)} and emergency services have been notified. All that and more in the week ${f.w} edition.`,f=>`In the basement, ${f.low.t.name} (${f1(f.low.pts)}) keeps proving that owning a roster is not the same as having a team.`],
  low:[f=>`With ${f1(f.low.pts)} points, ${f.low.t.name} remains the weekly relief of every opponent. Sources confirm the roster has been on strike since August.`,f=>`${f.low.t.name} finished with ${f1(f.low.pts)}. Even a replay review couldn't find more points.`],
  blow:f=>`${f.blow.W.t.name} ran over ${f.blow.L.t.name}, ${f1(f.blow.W.pts)} to ${f1(f.blow.L.pts)}. A ${f1(f.blow.m)}-point gap that has been reported to the authorities.`,
  close:f=>`${f.close.W.t.name} beat ${f.close.L.t.name} by just ${f1(f.close.m)}. League cardiologists remain on call.`,
  bench:f=>`${f.benchKing.t.name} left ${f1(f.benchKing.bench)} points rotting on the bench${f.benchKing.benchStar?`, including ${f1(f.benchKing.benchStar.p)} from ${nm(f.benchKing.benchStar.id)}`:''}. Head coach wanted; apply with the commissioner.`,
  lucky:f=>`${f.lucky.t.name} won with a measly ${f1(f.lucky.pts)}. Not even he believes it, but the W counts.`,
  unlucky:f=>`${f.unlucky.t.name} scored ${f1(f.unlucky.pts)}, more than ${f.unlucky.beat} teams, and still lost. Fantasy isn't fair, and nobody said it would be.`,
  trade:(a,b)=>`Deal on the table: ${a} and ${b} made a trade. December will tell us who cries.`,
  grind:(t,n)=>`${t} made ${n} waiver moves. Hyperactivity or panic, you decide.`,
  cap:{
   winBig:[x=>`Comfortable beatdown of ${x.opp.t.name} by ${f1(x.margin)}.`,x=>`Gave ${x.opp.t.name} a free lesson, winning by ${f1(x.margin)}.`],
   winClose:[x=>`Survived ${x.opp.t.name} by ${f1(x.margin)}, more luck than skill.`,x=>`Edged ${x.opp.t.name} by a hair: ${f1(x.margin)} points.`],
   loseBig:[x=>`${x.opp.t.name} knocked them flat by ${f1(x.margin)}.`,x=>`Lost by ${f1(x.margin)} to ${x.opp.t.name}. Pickup games have been closer.`],
   loseClose:[x=>`Fell by ${f1(x.margin)} to ${x.opp.t.name}. So close, so far.`,x=>`Lost by ${f1(x.margin)}: any decent backup would have saved it.`],
   star:[x=>`${nm(x.star.id)} carried with ${f1(x.star.p)}.`,x=>`MVP: ${nm(x.star.id)}, ${f1(x.star.p)}.`],
   dud:[x=>`${nm(x.dud.id)} chipped in ${f1(x.dud.p)}, which is generous.`,x=>`${nm(x.dud.id)} (${f1(x.dud.p)}) played like he's owed back pay.`],
   bench:x=>`Left ${f1(x.bench)} points on the bench.`,
   rec:x=>x.rec.l===0?`Now ${x.rec.w}-0, unbeaten and increasingly unbearable.`:x.rec.w===0?`Now 0-${x.rec.l} and still hunting the first W.`:`Record: ${x.rec.w}-${x.rec.l}.`},
  s:{of:'of',live:'Live',best:'Team of the week',worst:'The basement',blow:'Massacre',close:'Heart attack',bench:'The head coach',lucky:'Daylight robbery',unlucky:'The injustice',moves:'Market',caps:'Team by team',stand:'Standings',week:'Week',edition:'Edition'}}};
function writePaper(f,lang){
  const L=LINES[lang],r=rng(Number(S.leagueId.slice(-6))+f.w*97+(lang==='es'?1:2)),pick=a=>a[Math.floor(r()*a.length)];
  const stories=[{h:L.s.worst,b:pick(L.low)(f)},{h:L.s.blow,b:L.blow(f)},{h:L.s.close,b:L.close(f)}];
  if(f.benchKing&&f.benchKing.bench>8)stories.push({h:L.s.bench,b:L.bench(f)});
  if(f.lucky)stories.push({h:L.s.lucky,b:L.lucky(f)});
  if(f.unlucky)stories.push({h:L.s.unlucky,b:L.unlucky(f)});
  const mv=f.trades.map(tr=>L.trade(...(tr.roster_ids||[]).slice(0,2).map(id=>S.byRid[id]?S.byRid[id].name:'?')));
  if(f.grinder&&f.grinder[1]>=3)mv.push(L.grind(S.byRid[f.grinder[0]].name,f.grinder[1]));
  if(mv.length)stories.push({h:L.s.moves,b:mv.join(' ')});
  const caps=[...f.all].sort((a,b)=>b.pts-a.pts).map(x=>{const big=x.margin>25;const res=pick(L.cap[x.won?(big?'winBig':'winClose'):(big?'loseBig':'loseClose')])(x);
    const parts=[res];if(x.star)parts.push(pick(L.cap.star)(x));if(x.dud&&x.dud.p<6)parts.push(pick(L.cap.dud)(x));if(x.bench>12)parts.push(L.cap.bench(x));parts.push(L.cap.rec(x));
    return{name:x.t.name,handle:x.t.handle,pts:x.pts,body:parts.join(' ')}});
  return{headline:pick(L.head)(f),deck:pick(L.deck)(f),stories,caps};
}
function rPaper(){
  const weeks=range(1,S.week).filter(w=>(S.mu[w]||[]).some(m=>m.points>0));
  if(!weeks.length)return `<h2>Gazette</h2><p class="lede">The first edition prints once week 1 has points on the board.</p>`;
  if(!S.gzWeek||!weeks.includes(S.gzWeek))S.gzWeek=weeks.filter(w=>w<S.week).pop()||weeks[weeks.length-1];
  const f=weekFacts(S.gzWeek);const lang=S.lang||'es';const live=S.gzWeek===S.week;const native=!!LINES[lang];
  let P,L,trNote='';
  if(S.aiPaper[S.gzWeek+lang]){P=S.aiPaper[S.gzWeek+lang];L=(LINES[lang]||LINES.en).s}
  else if(native){P=writePaper(f,lang);L=LINES[lang].s}
  else{const T=gzTranslated(f,lang);P=T.P;L=T.L;trNote=T.note}
  const ctrl=`<div class="row"><select id="gzWeek" aria-label="Week">${weeks.map(w=>`<option value="${w}" ${w===S.gzWeek?'selected':''}>${L.week} ${w}${w===S.week?' (live)':''}</option>`).join('')}</select>
   ${langPicker(lang)}
   <button class="btn ghost" id="btnCopy">Copy for the group chat</button><button class="btn" id="btnAI" hidden>Have Claude write a sharper edition</button><span id="aiMsg" class="mute"></span></div>${trNote?`<p class="psub" style="margin:0 0 12px">${trNote}</p>`:''}`;
  return `<h2>The weekly roast</h2><p class="lede">Every storyline comes from real results: scores, margins, bench points left behind, lucky wins, trades and waiver moves.</p>${ctrl}
  <article class="paper" id="paperBody" lang="${h(lang)}" dir="${/^(ar|he|fa|ur)/.test(lang)?'rtl':'ltr'}">
    <header class="mast"><div class="name">El Pasquín</div><div class="sub">${h(S.league.name)}, ${h(L.week.toLowerCase())} ${f.w} ${h(L.of||'')} ${S.season}${live?` <span class="stamp">${h(L.live||'Live')}</span>`:''}</div></header>
    <h3 class="lead">${h(P.headline)}</h3><p class="deck">${h(P.deck)}</p>
    <div class="cols">${P.stories.map(s=>`<div class="story"><h4>${h(s.h)}</h4><p>${h(s.b)}</p></div>`).join('')}</div>
    <section class="caps"><h4 style="font-family:Anton,Impact,sans-serif;font-weight:400;font-size:30px;margin:0">${L.caps}</h4>
    <div class="cols">${P.caps.map(c=>`<div class="story"><h5>${h(c.name)}</h5><div class="rec">@${h(c.handle||'')}${c.pts!=null?', '+f1(c.pts):''}</div><p>${h(c.body)}</p></div>`).join('')}</div></section>
    <section class="caps"><h4 style="font-family:Anton,Impact,sans-serif;font-weight:400;font-size:30px;margin:0 0 6px">${L.stand}</h4><div class="scroll"><table><tbody>
    ${f.standings.map((s,i)=>`<tr><td>${i+1}</td><td>${h(s.t.name)}</td><td class="r">${s.w}-${s.l}</td></tr>`).join('')}</tbody></table></div></section>
  </article>`;
}
/* Claude-written edition: only lights up inside claude.ai where the sample capability exists */
let samplePromise=null;
function getSample(){if(!samplePromise)samplePromise=(window.claude&&window.claude.use)?window.claude.use('sample').catch(()=>null):Promise.resolve(null);return samplePromise}
async function aiEdition(){
  const s=await getSample();if(!s)return;const f=weekFacts(S.gzWeek);const lang=S.lang;const btn=$('#btnAI'),msg=$('#aiMsg');btn.disabled=true;msg.textContent='Writing…';
  const facts={league:S.league.name,week:f.w,results:f.games.map(g=>({winner:g.W.t.name,winner_pts:g.W.pts,loser:g.L.t.name,loser_pts:g.L.pts})),
    teams:f.all.map(x=>({team:x.t.name,manager:x.t.handle,pts:x.pts,won:x.won,record:`${x.rec.w}-${x.rec.l}`,bench_points_left:Math.round(x.bench*10)/10,best_starter:x.star&&{name:nm(x.star.id),pts:x.star.p},worst_starter:x.dud&&{name:nm(x.dud.id),pts:x.dud.p},best_benched:x.benchStar&&{name:nm(x.benchStar.id),pts:x.benchStar.p},teams_outscored:x.beat})),
    trades:f.trades.map(t=>(t.roster_ids||[]).map(id=>S.byRid[id]&&S.byRid[id].name)),waiver_moves:f.adds&&Object.fromEntries(Object.entries(f.adds).map(([k,v])=>[S.byRid[k]?S.byRid[k].name:k,v]))};
  const prompt=`You write a savage but friendly satirical fantasy football newspaper for a group of friends. Write in ${lang==='es'?'Mexican Spanish':langName(lang)}, casual and witty, no slurs, no insults about real-life traits. Roast everyone using ONLY these facts; never invent scores or players.\nFACTS: ${JSON.stringify(facts)}\nReturn ONLY JSON: {"headline":string,"deck":string,"stories":[{"h":string,"b":string}] (5-7 stories, 2-4 sentences each),"caps":[{"name":team name,"handle":manager,"pts":number,"body":2-3 sentence roast}] (one per team, ordered by points)}`;
  try{const out=await s.json(prompt,{modelTier:'default'});if(out&&out.headline){S.aiPaper[S.gzWeek+lang]=out;render()}else msg.textContent='The edition came back empty. Try again.'}
  catch(e){msg.textContent=e&&e.code==='rate_limited'?'Too many requests. Wait a minute and retry.':e&&e.code==='not_granted'?'Permission was not granted.':'Could not write the edition this time.';btn.disabled=false}
}

document.addEventListener('change',e=>{if(e.target.id==='gzWeek'){S.gzWeek=Number(e.target.value);render()}});
document.addEventListener('click',e=>{
  const lg=e.target.closest('[data-lang]');if(lg){setLang(lg.dataset.lang);return}
  if(e.target.id==='gzLangGo'){const v=($('#gzLangCode').value||'').trim();if(v)setLang(v)}
  if(e.target.id==='btnCopy'){const txt=$('#paperBody').innerText;navigator.clipboard&&navigator.clipboard.writeText(txt).then(()=>{e.target.textContent='Copied'},()=>{e.target.textContent='Copy blocked here'})}
  if(e.target.id==='btnAI')aiEdition();});
registerModule({key:'paper',label:'Gazette',order:90,render:rPaper,after(){getSample().then(s=>{const b=$('#btnAI');if(b&&s)b.hidden=false})}});

/* ============ Language: any language for the Gazette ============ */
const LANGS=[['es','Español'],['en','English'],['pt','Português'],['fr','Français'],['it','Italiano'],['de','Deutsch'],['nl','Nederlands'],['pl','Polski'],['sv','Svenska'],['da','Dansk'],['no','Norsk'],['fi','Suomi'],['tr','Türkçe'],['el','Ελληνικά'],['ru','Русский'],['uk','Українська'],['ro','Română'],['ca','Català'],['ar','العربية'],['he','עברית'],['hi','हिन्दी'],['ja','日本語'],['ko','한국어'],['zh-CN','中文 (简体)'],['zh-TW','中文 (繁體)'],['vi','Tiếng Việt'],['th','ไทย'],['id','Bahasa Indonesia'],['ms','Bahasa Melayu'],['tl','Tagalog'],['sw','Kiswahili']];
function langName(code){const k=LANGS.find(x=>x[0].toLowerCase()===String(code).toLowerCase());if(k)return k[1];try{return new Intl.DisplayNames(['en'],{type:'language'}).of(code)||code}catch(e){return code}}
function langPicker(lang){
  return `<details class="gz-lang"><summary class="btn ghost">Language: ${h(langName(lang))}</summary>
    <div class="gz-lang-pop"><div class="chips">${LANGS.map(([k,n])=>`<button class="chip" data-lang="${k}" aria-pressed="${k===lang}" lang="${k}">${h(n)}</button>`).join('')}</div>
    <div class="row" style="margin:10px 0 0"><label class="psub" for="gzLangCode">Another language (code like "gu" or "pa")</label><input id="gzLangCode" size="8" autocapitalize="none" spellcheck="false"><button class="btn ghost" id="gzLangGo" type="button">Use it</button></div>
    <p class="psub" style="margin:8px 0 0">Español and English are written natively. Other languages are machine-translated from the English edition, and names are kept as they are.</p></div></details>`;
}
function setLang(code){S.lang=code;store.set('wr_lang',code);render()}
const GZTR={};
function hashStr(s){let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)}return (x>>>0).toString(36)}
/* build the English edition, shield names behind [n] tokens, translate, restore */
function gzTranslated(f,lang){
  const P=writePaper(f,'en'),Ls=LINES.en.s;
  const names=[...new Set([...S.teams.flatMap(t=>[t.name,t.handle]),...f.all.flatMap(x=>[x.star,x.dud,x.benchStar].filter(Boolean).map(y=>nm(y.id))),S.league.name].filter(n=>n&&n.length>1))].sort((a,b)=>b.length-a.length);
  const shield=s=>{let o=String(s);names.forEach((n,i)=>{o=o.split(n).join(`[${i}]`)});return o};
  const unshield=s=>String(s).replace(/\[\s*(\d+)\s*\]/g,(m,i)=>names[Number(i)]??m);
  const src=[P.headline,P.deck,...P.stories.flatMap(s=>[s.h,s.b]),...P.caps.map(c=>c.body),Ls.week,Ls.of,Ls.live,Ls.caps,Ls.stand].map(shield);
  const key=`wr_gz_${lang}_${hashStr(src.join('␞'))}`;
  let done=GZTR[key];if(!done){try{const c=JSON.parse(store.get(key)||'null');if(c&&c.length===src.length)done=GZTR[key]=c}catch(e){}}
  if(!done&&!GZTR[key+'_busy']){GZTR[key+'_busy']=true;translateAll(src,lang).then(out=>{GZTR[key]=out;store.set(key,JSON.stringify(out));delete GZTR[key+'_busy'];if(S.tab==='paper')render()}).catch(err=>{GZTR[key+'_err']=err.message||String(err);delete GZTR[key+'_busy'];if(S.tab==='paper')render()})}
  if(!done){const err=GZTR[key+'_err'];return{P,L:Ls,note:err?`Couldn't translate to ${h(langName(lang))}: ${h(err)} Showing English.`:`Translating to ${h(langName(lang))}… Showing English until it's ready.`}}
  let i=0;const t=()=>unshield(done[i++]);
  const TP={headline:t(),deck:t(),stories:P.stories.map(()=>({h:t(),b:t()})),caps:P.caps.map(c=>({...c,body:t()}))};
  const TL={...Ls,week:t(),of:t(),live:t(),caps:t(),stand:t()};
  return{P:TP,L:TL,note:`Machine-translated to ${h(langName(lang))}.`};
}
async function translateAll(list,lang){
  const cfg=(CONFIG.translate||{provider:'mymemory'});const out=new Array(list.length);let next=0,firstErr=null;
  const one=async s=>{
    if(!s||!s.trim())return s;
    if(cfg.provider==='libretranslate'){const r=await fetch(cfg.url.replace(/\/$/,'')+'/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:s,source:'en',target:lang.split('-')[0],format:'text',api_key:cfg.key||undefined})});if(!r.ok)throw new Error('Translation service returned '+r.status+'.');return (await r.json()).translatedText}
    if(cfg.provider==='proxy'){const r=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:s,source:'en',target:lang})});if(!r.ok)throw new Error('Translation service returned '+r.status+'.');const d=await r.json();return d.text||d.translatedText}
    // MyMemory: free, no key, about 5,000 characters a day per visitor (50,000 with an email in config)
    const parts=s.length<=480?[s]:s.match(/[^.!?]+[.!?]*\s*/g).reduce((a,x)=>{if(a.length&&(a[a.length-1]+x).length<=480)a[a.length-1]+=x;else a.push(x);return a},[]);
    const res=[];for(const p of parts){const u=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=en|${encodeURIComponent(lang)}${cfg.email?'&de='+encodeURIComponent(cfg.email):''}`;
      const r=await fetch(u);if(!r.ok)throw new Error('Translation service returned '+r.status+'.');const d=await r.json();const txt=d&&d.responseData&&d.responseData.translatedText;
      if(!txt||Number(d.responseStatus)!==200||/MYMEMORY WARNING/i.test(txt))throw new Error(/QUOTA|WARNING/i.test(String(txt)+String(d.responseDetails))?'The free daily translation quota on this device is used up. Try again tomorrow.':'The translation service refused this language code.');
      res.push(txt)}
    return res.join(' ');
  };
  const worker=async()=>{while(next<list.length&&!firstErr){const i=next++;try{out[i]=await one(list[i])}catch(e){firstErr=e}}};
  await Promise.all([worker(),worker(),worker(),worker()]);
  if(firstErr)throw firstErr;return out;
}
