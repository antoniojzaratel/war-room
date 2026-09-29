// Stripe calls this after checkout and whenever a subscription changes. It is the only writer of public.subscriptions.
// Deployed with JWT verification off (Stripe doesn't send a Supabase token); the Stripe signature is checked instead.
import type Stripe from "npm:stripe@17";
import { admin, cryptoProvider, stripe } from "../_shared/common.ts";

const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

async function userIdFor(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.user_id) return sub.metadata.user_id;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customer).maybeSingle();
  return data?.id ?? null;
}

async function save(sub: Stripe.Subscription) {
  const user_id = await userIdFor(sub);
  if (!user_id) { console.error("No user for subscription", sub.id); return; }
  const item = sub.items.data[0];
  const loose = (x: unknown) => (x as { current_period_end?: number } | undefined)?.current_period_end;
  const end = loose(sub) ?? loose(item); // on the subscription in older API versions, on the item in newer ones
  const { error } = await admin.from("subscriptions").upsert({
    id: sub.id,
    user_id,
    status: sub.status,
    price_id: item?.price.id ?? null,
    interval: item?.price.recurring?.interval ?? null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider);
  } catch (e) {
    return new Response(`Bad signature: ${(e as Error).message}`, { status: 400 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          if (!sub.metadata?.user_id && s.client_reference_id) sub.metadata = { ...sub.metadata, user_id: s.client_reference_id };
          await save(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await save(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (e) {
    console.error(e);
    return new Response("Webhook handler failed", { status: 500 }); // Stripe retries
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
