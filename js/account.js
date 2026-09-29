/* Accounts and plans.
   With CONFIG.supabase.url empty the site runs in dev mode: no accounts, username sign-in, every feature unlocked.
   With Supabase configured: Google sign-in, a profile linked to a Sleeper username, the chosen league saved to the account,
   and a plan (free, premium through Stripe, or comp through an invite code or the comp list) read from the database. */
const ACC={mode:'dev',sb:null,session:null,profile:null,plan:'dev',until:null,source:null,ready:false};
const PREMIUM={
  upside:{name:'Best chance to win',line:'Lineups built to beat this week’s opponent, with each player’s floor and ceiling.'},
  outlook:{name:'Team outlook',line:'Contender, win now, rebuilding or tanking for every team, with the moves that fit.'},
  future:{name:'Next 3 seasons',line:'Every roster projected forward with aging curves and draft picks turning into rookies.'},
  tradeFinder:{name:'Trade finder',line:'Every realistic deal in your league tested, and the win-win ones served up.'},
  multiTrade:{name:'3 and 4 team trades',line:'Build trades with up to four teams and see who wins now and in two years.'},
  history:{name:'League history',line:'All-time standings, records, best players and a ledger that grades every trade ever made.'},
  book:{name:'Full sportsbook',line:'Player props, specials, futures, parlays, hindsight and your league’s leaderboard.'},
  gazette:{name:'Gazette in any language',line:'The weekly roast written by AI in each reader’s own language.'}
};
const hasPro=()=>ACC.plan!=='free';
const needsPro=f=>!hasPro()&&!!PREMIUM[f];
function proCard(f,compact){const x=PREMIUM[f]||{name:'Premium',line:''};const P=CONFIG.pricing||{};
  const signedIn=!!ACC.session;
  return `<div class="panel pro-card${compact?' pro-compact':''}"><div class="pro-badge">Premium</div><h3 style="margin:6px 0 4px">${h(x.name)}</h3><p style="margin:0 0 12px">${h(x.line)}</p>
    ${signedIn?`<div class="row" style="margin:0"><button class="btn" data-upgrade="yearly">${h(P.yearly||'')} a year</button><button class="btn ghost" data-upgrade="monthly">${h(P.monthly||'')} a month</button><button class="btn ghost" data-go="account">I have a code</button></div>`:
      `<button class="btn" data-signin="google">Sign in to upgrade</button>`}
    <p class="psub" style="margin:10px 0 0">Premium unlocks every locked tool across all your leagues. Cancel any time.</p></div>`}

async function accInit(){
  const cfg=window.__drTestConfig||CONFIG.supabase||{}; // test hook: automated tests inject a config and a fake client
  if(!cfg.url||!cfg.anonKey){ACC.mode='dev';ACC.plan='dev';ACC.ready=true;return}
  ACC.mode='live';ACC.plan='free';
  const {createClient}=window.__drTestSupabase||await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  ACC.sb=createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
  const {data}=await ACC.sb.auth.getSession();ACC.session=data.session;
  ACC.sb.auth.onAuthStateChange((ev,session)=>{const was=!!ACC.session;ACC.session=session;if(ev==='SIGNED_OUT'||(!was&&session))location.reload()});
  if(ACC.session)await accRefresh();
  ACC.ready=true;
}
async function accRefresh(){
  if(!ACC.sb||!ACC.session)return;
  const uid=ACC.session.user.id;
  const [{data:prof},{data:plan}]=await Promise.all([ACC.sb.from('profiles').select('*').eq('id',uid).maybeSingle(),ACC.sb.rpc('my_plan')]);
  ACC.profile=prof||{id:uid};
  const p=Array.isArray(plan)?plan[0]:plan;ACC.plan=(p&&p.plan)||'free';ACC.until=p&&p.until;ACC.source=p&&p.source;
}
async function accSave(patch){if(!ACC.sb||!ACC.session)return;Object.assign(ACC.profile||{},patch);
  const {error}=await ACC.sb.from('profiles').upsert({id:ACC.session.user.id,...patch});if(error)console.error(error)}
async function accInvoke(fn,body){const {data,error}=await ACC.sb.functions.invoke(fn,{body:body||{}});
  if(error){let msg=error.message;try{const j=await error.context.json();msg=j.error||msg}catch(e){}throw new Error(msg)}return data}
async function signInGoogle(){await ACC.sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}})}
async function startCheckout(kind,btn){
  if(!ACC.session)return signInGoogle();
  if(btn){btn.disabled=true;btn.textContent='Opening checkout…'}
  try{const r=await accInvoke('create-checkout',{plan:kind,returnUrl:location.origin+location.pathname});location.href=r.url}
  catch(e){alert('Checkout couldn’t start: '+e.message);if(btn){btn.disabled=false;btn.textContent='Try again'}}
}
document.addEventListener('click',e=>{
  const u=e.target.closest('[data-upgrade]');if(u){startCheckout(u.dataset.upgrade,u);return}
  const g=e.target.closest('[data-signin="google"]');if(g){if(ACC.mode==='live')signInGoogle();else{const i=$('#suUser');if(i)i.focus();else showSignIn()}return}
  const go=e.target.closest('[data-go]');if(go){S.tab=go.dataset.go;if(S.league){renderChrome();render()}else if(typeof renderAccountOnly==='function')renderAccountOnly();window.scrollTo(0,0)}
});
