// Opens the Stripe customer portal: change card, switch monthly/yearly, cancel, download invoices.
import { admin, corsHeaders, fail, json, safeReturnUrl, stripe, userFrom } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, "Use POST.", 405);
  const user = await userFrom(req);
  if (!user) return fail(req, "Sign in first.", 401);
  const { returnUrl } = await req.json().catch(() => ({}));
  const { data: prof } = await admin.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (!prof?.stripe_customer_id) return fail(req, "There's no billing account yet. Upgrade first.");
  const session = await stripe.billingPortal.sessions.create({
    customer: prof.stripe_customer_id,
    return_url: `${safeReturnUrl(returnUrl)}#account`,
  });
  return json(req, { url: session.url });
});
