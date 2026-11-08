import { clients, corsHeaders, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { admin, anon } = clients();
    const header = req.headers.get("Authorization");
    if (!header) return json({ error: "Требуется авторизация" }, 401);
    const token = header.replace(/^Bearer\s+/i, "");
    const { data, error: authError } = await anon.auth.getUser(token);
    if (authError || !data.user) return json({ error: "Недействительная сессия" }, 401);
    const { newPassword } = await req.json();
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return json({ error: "Пароль должен содержать не менее 6 символов" }, 400);
    }
    const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, { password: newPassword });
    if (updateError) throw updateError;
    const { error: profileError } = await admin.from("profiles")
      .update({ force_password_change: false }).eq("id", data.user.id);
    if (profileError) throw profileError;
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось изменить пароль" }, 400);
  }
});
