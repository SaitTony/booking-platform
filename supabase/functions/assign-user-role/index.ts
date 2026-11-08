import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin, anon } = clients();
    const actor = await requireOwner(req, admin, anon);
    const body = await req.json();
    const userId = body.userId;
    const role = body.role;
    const companyId = body.companyId ?? null;
    const masterId = body.masterId ?? null;

    if (typeof userId !== "string" || !["admin", "master", "master_pro"].includes(role)) {
      return json({ error: "Некорректный пользователь или роль" }, 400);
    }
    if (companyId !== null && typeof companyId !== "string") {
      return json({ error: "Некорректная компания" }, 400);
    }
    if (masterId !== null && typeof masterId !== "string") {
      return json({ error: "Некорректная страница мастера" }, 400);
    }

    const { error } = await admin.rpc("owner_assign_user_role", {
      p_actor_id: actor.id,
      p_user_id: userId,
      p_role: role,
      p_company_id: companyId,
      p_master_id: masterId,
    });
    if (error) throw error;

    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось назначить роль" }, 400);
  }
});
