// Shared helpers for Dynasty Room edge functions.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

// Browsers may only call these functions from the site itself (plus localhost while developing).
const allowed = (Deno.env.get("SITE_URL") ?? "https://dynasty-room.com")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] ?? "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

export function fail(req: Request, message: string, status = 400): Response {
  return json(req, { error: message }, status);
}

/** Only return to pages on our own site after checkout or the billing portal. */
export function safeReturnUrl(url: unknown): string {
  const fallback = allowed[0] ?? "https://dynasty-room.com";
  if (typeof url !== "string") return fallback;
  try {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`;
    if (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return `${origin}${u.pathname}`;
  } catch { /* fall through */ }
  return fallback;
}

export const admin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** The signed-in user behind the request, or null. */
export async function userFrom(req: Request): Promise<User | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

export async function planFor(user: User): Promise<string> {
  const { data } = await admin.rpc("plan_for", { p_uid: user.id, p_email: user.email ?? "" });
  const row = Array.isArray(data) ? data[0] : data;
  return row?.plan ?? "free";
}

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

/** Stripe customer for this user, created the first time they check out. */
export async function customerFor(user: User): Promise<string> {
  const { data: prof } = await admin.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (prof?.stripe_customer_id) return prof.stripe_customer_id;
  const c = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
  await admin.from("profiles").upsert({ id: user.id, email: user.email, stripe_customer_id: c.id });
  return c.id;
}
