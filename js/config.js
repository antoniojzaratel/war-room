/* Dynasty Room settings. Everything here is safe to publish: the Supabase anon key is public by design,
   and Stripe secret keys live only in Supabase function secrets (see docs/LAUNCH.md). */
const CONFIG={
  appName:'Dynasty Room',
  siteUrl:'https://dynasty-room.com',
  featuredLeagueId:'1314840770154364928',   // La Dinastía: listed first when a user belongs to it

  /* Backend. Leave url empty to run without accounts: username sign-in, every feature unlocked (handy for testing). */
  supabase:{url:'',anonKey:''},

  /* Plans shown on the pricing section. Stripe price ids go in the Supabase function secrets, not here. */
  pricing:{monthly:'$4.99',yearly:'$14.99',currency:'USD'},

  /* Data sources. Sleeper covers leagues, projections, scores and the schedule.
     espnClock adds the live game clock to live projections (factual data from ESPN's public scoreboard);
     espnNews shows ESPN headlines, which are ESPN's content: keep it off for the commercial site. */
  sources:{espnClock:true,espnNews:false},

  /* Gazette translation for free machine translation in dev mode. With the backend on, premium members get
     editions written by AI in their own language instead (the ai-gazette function). */
  translate:{provider:'mymemory',email:''}
};
