import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token.trim().toLowerCase() : "";
    if (!TOKEN_PATTERN.test(token)) return json({ error: "invalid_token" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const tokenHash = await sha256Hex(token);
    const { data: claimed, error: claimError } = await admin
      .from("device_login_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("profile_id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return json({ error: "expired_or_used" }, 404);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id")
      .eq("id", claimed.profile_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.user_id) return json({ error: "account_not_found" }, 404);

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
    if (userError || !userData.user?.email) throw userError ?? new Error("no email");

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });
    if (linkError || !linkData.properties?.hashed_token) throw linkError ?? new Error("no link");

    return json({ token_hash: linkData.properties.hashed_token });
  } catch (error) {
    console.error("complete-device-login failed", error);
    return json({ error: "server_error" }, 500);
  }
});
