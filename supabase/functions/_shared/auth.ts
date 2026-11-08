import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "https://saittony.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function clients() {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) throw new Error("Supabase server secrets are not configured");
  return {
    anon: createClient(url, anon, { auth: { persistSession: false } }),
    admin: createClient(url, service, { auth: { persistSession: false } }),
  };
}

export async function requireOwner(req: Request, admin: ReturnType<typeof createClient>, anon: ReturnType<typeof createClient>): Promise<User> {
  const header = req.headers.get("Authorization");
  if (!header) throw new Error("Требуется авторизация");
  const token = header.replace(/^Bearer\s+/i, "");
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) throw new Error("Недействительная сессия");
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("platform_role,force_password_change,disabled_at").eq("id", data.user.id).single();
  if (profileError || profile?.platform_role !== "owner" || profile.force_password_change || profile.disabled_at) {
    throw new Error("Только активный Owner может выполнять эту операцию");
  }
  return data.user;
}
