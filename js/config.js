/* Anyone opening the site signs in with their Sleeper username and picks one of their leagues.
   Links can skip that: ?user=<sleeper username>&league=<league id>. */
const CONFIG={
  featuredLeagueId:'1314840770154364928',  // La Dinastía: listed first and marked when a user belongs to it
  siteUrl:'',                              // your GitHub Pages address, e.g. https://yourname.github.io/war-room/
  /* Gazette translation for languages other than Spanish and English.
     mymemory: free, no key, ~5,000 characters a day per visitor (add an email for ~50,000).
     For a commercial launch use {provider:'libretranslate', url:'https://your-server', key:''} or
     {provider:'proxy', url:'https://your-function'} that receives {text,source,target} and returns {text} (e.g. DeepL or Google behind it). */
  translate:{provider:'mymemory',email:''}
};
