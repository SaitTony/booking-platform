import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin, anon } = clients();
    const actor = await requireOwner(req, admin, anon);
    const { userId, disabled } = await req.json();

    if (typeof userId !== "string" || typeof disabled !== "boolean") {
      return json({ error: "Укажите пользователя и новый статус доступа" }, 400);
    }
    if (userId === actor.id) {
      return json({ error: "Нельзя отключить собственную учётную запись Owner" }, 400);
    }

    const { data: target, error: lookupError } = await admin
      .from("profiles")
      .select("id,platform_role")
      .eq("id", userId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!target) return json({ error: "Учётная запись не найдена" }, 404);
    if (target.platform_role === "owner") {
      return json({ error: "Отключение учётной записи Owner запрещено" }, 403);
    }

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: disabled ? "876000h" : "0s",
    });
    if (authError) throw authError;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ disabled_at: disabled ? new Date().toISOString() : null })
      .eq("id", userId);
    if (profileError) throw profileError;

    return json({ success: true, disabled });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось изменить доступ" }, 400);
  }
});
