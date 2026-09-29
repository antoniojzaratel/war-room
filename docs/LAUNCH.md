# Launching Dynasty Room on dynasty-room.com

About an hour of clicking, in this order. You need: the domain, a GitHub account, and a Google account. Everything below has a free tier except Stripe's per-payment fee and the Anthropic API (a few cents per AI gazette).

```
Browser (dynasty-room.com on Cloudflare Pages)
  ├── Sleeper API, ESPN scoreboard ........ public data, called directly from the browser
  └── Supabase
        ├── Auth (Google sign-in)
        ├── Postgres: profiles, subscriptions, comp access, bets, gazettes (row level security on)
        └── Edge Functions: create-checkout, billing-portal, stripe-webhook, ai-gazette
                ├── Stripe (payments)
                └── Anthropic (AI gazette)
```

## 1. Put the code on GitHub

Create a **private** repository called `dynasty-room` and push this folder to it:

```bash
git remote add origin https://github.com/<you>/dynasty-room.git
git push -u origin main
```

## 2. Supabase: database

1. Create a project at [supabase.com](https://supabase.com) (region: `East US` is closest to Monterrey among the US regions). Save the database password somewhere safe.
2. **SQL Editor → New query**: paste all of `supabase/migrations/20260929000000_dynasty_room.sql` and run it. (Or with the CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `js/config.js`:

```js
supabase:{url:'https://<ref>.supabase.co',anonKey:'<anon public key>'},
```

The anon key is meant to be public. Never put the `service_role` key in the website.

## 3. Google sign-in

1. [Google Cloud Console](https://console.cloud.google.com) → create a project "Dynasty Room".
2. **APIs & Services → OAuth consent screen**: External; app name Dynasty Room; support email; logo optional; app domain `https://dynasty-room.com`; privacy policy `https://dynasty-room.com/privacy.html`; terms `https://dynasty-room.com/terms.html`; authorized domains `dynasty-room.com` and `supabase.co`; scopes: `email`, `profile`, `openid`. Publish the app (these basic scopes don't need Google's review).
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://dynasty-room.com`, `https://www.dynasty-room.com`
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
4. Supabase → **Authentication → Providers → Google**: enable, paste the client ID and secret.
5. Supabase → **Authentication → URL Configuration**: Site URL `https://dynasty-room.com`; Redirect URLs `https://dynasty-room.com`, `https://www.dynasty-room.com`, and `http://localhost:8080` for testing.

## 4. Stripe

Start in **Test mode** (toggle at the top of the Stripe dashboard) and repeat with live keys at the end.

1. Create the account (Mexico is supported; you can charge in USD).
2. **Product catalog → Add product** "Dynasty Room Premium" with two recurring prices: **USD 4.99 monthly** and **USD 14.99 yearly**. Copy both price IDs (`price_...`).
3. **Settings → Billing → Customer portal**: turn on cancel subscriptions, update payment methods, and switch plans between the two prices. Add your privacy and terms links.
4. **Developers → Webhooks → Add endpoint**: `https://<ref>.supabase.co/functions/v1/stripe-webhook`, events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`. Copy the signing secret (`whsec_...`).
5. **Developers → API keys**: copy the secret key (`sk_test_...`, later `sk_live_...`).

## 5. Anthropic (AI gazette)

Create an API key at [console.anthropic.com](https://console.anthropic.com) and add some credit. The function uses Claude Haiku 4.5 by default and caps each user at 25 editions a day (`AI_DAILY_LIMIT`).

## 6. Deploy the functions

With the [Supabase CLI](https://supabase.com/docs/guides/cli) installed:

```bash
supabase login
supabase link --project-ref <ref>
supabase secrets set \
  SITE_URL=https://dynasty-room.com,https://www.dynasty-room.com \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_... \
  ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy create-checkout
supabase functions deploy billing-portal
supabase functions deploy ai-gazette
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 7. Host the site on dynasty-room.com

1. [Cloudflare](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git** → pick the repository.
2. Framework preset: **None**. Build command: *(empty)*. Build output directory: `/`.
3. After the first deploy: **Custom domains → Set up a custom domain** → `dynasty-room.com`, then again for `www.dynasty-room.com`. If the domain was bought elsewhere, Cloudflare shows the two nameservers to set at your registrar (or the CNAME to add).
4. The `_headers` file adds security headers automatically. Every `git push` redeploys.

## 8. La Dinastía gets Premium free

In the Supabase SQL editor, create the league's invite code (12 uses covers everyone plus a spare):

```sql
insert into public.invite_codes (code, note, max_uses) values ('DINASTIA-N4PDMM', 'La Dinastía', 12);
```

Post the code in the WhatsApp group. Each friend signs in with Google, opens **Account**, and redeems it. To see who has used it: `select * from public.comp_grants;`. To give someone free access by email instead: `insert into public.comp_emails (email, note) values ('friend@gmail.com', 'La Dinastía');`

## 9. Test before charging anyone

- [ ] Sign in with Google on the live site; link your Sleeper username; pick La Dinastía.
- [ ] As a free user, locked tools show the Premium card.
- [ ] Upgrade yearly with Stripe's test card `4242 4242 4242 4242`, any future date, any CVC. After the redirect the header shows **Premium** within a few seconds (Stripe → Webhooks shows a `200`).
- [ ] Account → Manage billing opens the Stripe portal; cancel there; after the period ends (or cancel immediately in the Stripe dashboard) the header returns to **Free**.
- [ ] Redeem the invite code on a second Google account.
- [ ] Place a play-money bet on two accounts and check the league leaderboard.
- [ ] Gazette → Language → Français writes an AI edition.
- [ ] Open `privacy.html` and `terms.html`, and have a lawyer review them before launch.

Then switch Stripe to **live mode**: create the product and prices again, a new webhook endpoint and secret, and run `supabase secrets set` with the live values.

## Running it

- **Delete an account** on request: `delete from auth.users where email = 'person@gmail.com';` (profiles, bets, comp access and gazettes go with it).
- **Logs**: Supabase → Edge Functions → each function → Logs. Stripe → Developers → Events.
- **Without accounts** (dev mode): leave `supabase.url` empty in `js/config.js`. Username sign-in, everything unlocked.
- **Single-file build**: `python3 scripts/build.py` writes `dist/dynasty-room.html`.
