import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, anon } = clients();
    await requireOwner(req, admin, anon);
    const { targetUserId, newTemporaryPassword } = await req.json();
    if (typeof targetUserId !== "string" || typeof newTemporaryPassword !== "string" || newTemporaryPassword.length < 6) {
      return json({ error: "Укажите пользователя и временный пароль длиной от 6 символов" }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(targetUserId, { password: newTemporaryPassword });
    if (error) throw error;
    const { error: flagError } = await admin.from("profiles").update({ force_password_change: true }).eq("id", targetUserId);
    if (flagError) throw flagError;
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось обновить доступ" }, 400);
  }
});
