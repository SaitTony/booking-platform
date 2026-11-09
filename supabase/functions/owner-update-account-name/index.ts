import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin, anon } = clients();
    const actor = await requireOwner(req, admin, anon);
    const { userId, fullName } = await req.json();

    if (typeof userId !== "string" || typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 120) {
      return json({ error: "Укажите имя пользователя длиной до 120 символов" }, 400);
    }
    if (userId === actor.id) {
      return json({ error: "Изменение имени текущего Owner через этот метод запрещено" }, 403);
    }

    const { data: target, error: lookupError } = await admin
      .from("profiles")
      .select("id,platform_role")
      .eq("id", userId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!target) return json({ error: "Учётная запись не найдена" }, 404);
    if (target.platform_role === "owner") return json({ error: "Изменение другого Owner запрещено" }, 403);

    const { error: updateError } = await admin
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", userId);
    if (updateError) throw updateError;

    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось изменить имя пользователя" }, 400);
  }
});
