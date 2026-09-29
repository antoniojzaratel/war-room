/* Account: plan, billing, invite code, linked Sleeper username, sign out. Not in the tab bar; opened from the header. */
function rAccount(){
  const P=CONFIG.pricing||{};
  if(ACC.mode==='dev')return `<h2>Account</h2><div class="panel"><p style="margin:0">Accounts are off in this build, so every feature is unlocked. Add the Supabase settings in <code>js/config.js</code> to turn on Google sign-in and Premium.</p></div>${pricingBlock()}`;
  const email=ACC.session&&ACC.session.user.email;const pr=ACC.profile||{};
  const status=ACC.plan==='premium'?`<div class="verdict up">Premium</div><p style="margin:6px 0 0">${ACC.until?`Renews or ends on ${new Date(ACC.until).toLocaleDateString()}.`:'Active.'}</p><div class="row" style="margin:12px 0 0"><button class="btn ghost" id="accPortal">Manage billing</button></div>`
    :ACC.plan==='comp'?`<div class="verdict up">Premium, on the house</div><p style="margin:6px 0 0">${h(ACC.source==='code'?'Unlocked with an invite code.':ACC.source==='email'?'Your email is on the comp list.':'Complimentary access.')}${ACC.until?` Until ${new Date(ACC.until).toLocaleDateString()}.`:' No end date.'}</p>`
    :`<div class="verdict">Free plan</div><p style="margin:6px 0 12px">Upgrade to unlock every locked tool in all your leagues.</p><div class="row" style="margin:0"><button class="btn" data-upgrade="yearly">${h(P.yearly)} a year</button><button class="btn ghost" data-upgrade="monthly">${h(P.monthly)} a month</button></div>`;
  return `<h2>Account</h2><p class="lede">Signed in as ${h(email||'')}.</p>
  <div class="grid2">
    <div class="panel"><h3 style="margin-top:0">Plan</h3>${status}</div>
    <div class="panel"><h3 style="margin-top:0">Invite code</h3><p class="psub" style="margin:-4px 0 10px">Got a code from your league or a promotion? Enter it here.</p>
      <form id="accCode" class="row" style="margin:0"><input id="accCodeIn" autocapitalize="characters" spellcheck="false" placeholder="CODE" aria-label="Invite code"><button class="btn ghost" type="submit">Redeem</button></form><p id="accCodeMsg" class="psub" style="margin:8px 0 0"></p></div>
    <div class="panel"><h3 style="margin-top:0">Sleeper account</h3><p style="margin:0 0 10px">Linked to <b>@${h(pr.sleeper_username||'nobody yet')}</b>.</p>
      <form id="accSleeper" class="row" style="margin:0"><input id="accSleeperIn" value="${h(pr.sleeper_username||'')}" autocapitalize="none" spellcheck="false" aria-label="Sleeper username"><button class="btn ghost" type="submit">Change</button></form><p id="accSleeperMsg" class="psub" style="margin:8px 0 0"></p></div>
    <div class="panel"><h3 style="margin-top:0">Session</h3><p style="margin:0 0 10px">Your leagues, bets and settings are saved to this account.</p><button class="btn ghost" id="accOut">Sign out</button></div>
  </div>`;
}
function pricingBlock(){const P=CONFIG.pricing||{};
  const free=['Live scores and live projections','Optimal lineup and next-4-weeks planner','Power and dynasty rankings','Season forecast: playoff, title and toilet bowl odds','Two-team trade calculator','Waivers, injuries and Sleeper buzz','Sportsbook game lines with play money','The weekly roast in Spanish or English'];
  const pro=Object.values(PREMIUM).map(x=>x.name+': '+x.line);
  return `<section class="pricing"><div class="panel"><h3 style="margin-top:0">Free</h3><div class="price num">$0</div><ul>${free.map(x=>`<li>${h(x)}</li>`).join('')}</ul></div>
    <div class="panel pro-plan"><h3 style="margin-top:0">Premium</h3><div class="price num">${h(P.monthly)}<span class="psub"> a month</span></div><div class="psub" style="margin:-2px 0 10px">or ${h(P.yearly)} a year</div><p style="margin:0 0 6px">Everything in Free, plus:</p><ul>${pro.map(x=>`<li>${h(x)}</li>`).join('')}</ul></div></section>`}
async function accSubmitSleeper(name,msgEl){
  name=(name||'').trim();if(!name)return;msgEl.textContent='Checking Sleeper…';
  let u=null;try{u=await j(`${API}/v1/user/${encodeURIComponent(name)}`)}catch(e){}
  if(!u||!u.user_id){msgEl.textContent=`Sleeper has no user called "${name}".`;return}
  await accSave({sleeper_username:u.display_name||name,sleeper_user_id:u.user_id,default_league_id:null});
  S.username=u.display_name||name;S.leagueId='';store.set('wr_user',S.username);store.set('wr_league','');msgEl.textContent='Linked. Loading your leagues…';
  S.tab='live';boot(()=>signIn(S.username));
}
document.addEventListener('submit',async e=>{
  if(e.target.id==='accCode'){e.preventDefault();const m=$('#accCodeMsg');m.textContent='Checking…';
    const {data,error}=await ACC.sb.rpc('redeem_code',{p_code:$('#accCodeIn').value.trim()});
    if(error){m.textContent=error.message.replace(/^.*?: /,'');return}
    if(data==='already'){m.textContent='You already have complimentary access.';return}
    await accRefresh();if(S.league){renderChrome();render()}else renderAccountOnly()}
  if(e.target.id==='accSleeper'){e.preventDefault();accSubmitSleeper($('#accSleeperIn').value,$('#accSleeperMsg'))}
});
document.addEventListener('click',async e=>{
  if(e.target.id==='accOut'){await ACC.sb.auth.signOut();store.set('wr_user','');store.set('wr_league','');location.href=location.pathname}
  if(e.target.id==='accPortal'){e.target.disabled=true;try{const r=await accInvoke('billing-portal',{returnUrl:location.origin+location.pathname});location.href=r.url}catch(err){alert(err.message);e.target.disabled=false}}
});
function renderAccountOnly(){bare(CONFIG.appName,'Your account');$('#main').innerHTML=rAccount()}
registerModule({key:'account',label:'Account',order:999,hidden:true,render:rAccount});
