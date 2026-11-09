import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin, anon } = clients();
    const actor = await requireOwner(req, admin, anon);
    const { userId } = await req.json();

    if (typeof userId !== "string") {
      return json({ error: "Укажите учётную запись для удаления" }, 400);
    }
    if (userId === actor.id) {
      return json({ error: "Нельзя удалить собственную учётную запись Owner" }, 400);
    }

    const { data: target, error: lookupError } = await admin
      .from("profiles")
      .select("id,platform_role")
      .eq("id", userId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!target) return json({ error: "Учётная запись не найдена" }, 404);
    if (target.platform_role === "owner") {
      return json({ error: "Удаление учётной записи Owner запрещено" }, 403);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ success: true });
  } catch (error) {
    console.error("owner-delete-user failed", error);
    return json({ error: error instanceof Error ? error.message : "Не удалось удалить учётную запись" }, 500);
  }
});
