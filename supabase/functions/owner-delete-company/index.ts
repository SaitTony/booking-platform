import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin, anon } = clients();
    const actor = await requireOwner(req, admin, anon);
    const { companyId } = await req.json();
    if (typeof companyId !== "string" || !companyId) {
      return json({ error: "Не указана компания для удаления" }, 400);
    }

    const { data, error } = await admin.rpc("owner_delete_company", {
      p_actor_id: actor.id,
      p_company_id: companyId,
    });
    if (error) throw error;
    return json(data);
  } catch (error) {
    console.error("owner-delete-company failed", error);
    return json({ error: error instanceof Error ? error.message : "Не удалось удалить компанию" }, 500);
  }
});
