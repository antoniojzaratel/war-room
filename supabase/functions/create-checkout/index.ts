// Starts a Stripe Checkout session for Dynasty Room Premium: monthly or yearly.
import { corsHeaders, customerFor, fail, json, planFor, safeReturnUrl, stripe, userFrom } from "../_shared/common.ts";

const PRICES: Record<string, string | undefined> = {
  monthly: Deno.env.get("STRIPE_PRICE_MONTHLY"),
  yearly: Deno.env.get("STRIPE_PRICE_YEARLY"),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, "Use POST.", 405);
  const user = await userFrom(req);
  if (!user) return fail(req, "Sign in first.", 401);
  const { plan, returnUrl } = await req.json().catch(() => ({}));
  const price = PRICES[plan];
  if (!price) return fail(req, "Choose monthly or yearly.");
  if ((await planFor(user)) !== "free") return fail(req, "You already have Premium.");
  const back = safeReturnUrl(returnUrl);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(user),
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${back}?checkout=success`,
    cancel_url: `${back}?checkout=cancel#account`,
  });
  return json(req, { url: session.url });
});
