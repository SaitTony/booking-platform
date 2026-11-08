import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, anon } = clients();
    await requireOwner(req, admin, anon);
    const { userId, role, companyId, masterId } = await req.json();
    if (typeof userId !== "string" || !["admin", "master", "master_pro"].includes(role)) {
      return json({ error: "Некорректный пользователь или роль" }, 400);
    }
    const { data: target } = await admin.from("profiles").select("id,platform_role").eq("id", userId).single();
    if (!target || target.platform_role === "owner") return json({ error: "Пользователь не найден" }, 404);

    await admin.from("company_members").delete().eq("profile_id", userId);
    await admin.from("masters").update({ profile_id: null }).eq("profile_id", userId);

    if (role === "master_pro") {
      const { data: page } = await admin.from("masters").select("id,kind,company_id,profile_id").eq("id", masterId).single();
      if (!page || page.kind !== "individual" || page.company_id || page.profile_id) {
        return json({ error: "Выберите свободную индивидуальную страницу" }, 400);
      }
      const { error } = await admin.from("masters").update({ profile_id: userId }).eq("id", masterId);
      if (error) throw error;
      const { error: roleError } = await admin.from("profiles").update({ platform_role: "master_pro" }).eq("id", userId);
      if (roleError) throw roleError;
    } else {
      if (typeof companyId !== "string") return json({ error: "Выберите компанию" }, 400);
      if (role === "master") {
        const { data: page } = await admin.from("masters").select("id,kind,company_id,profile_id").eq("id", masterId).single();
        if (!page || page.kind !== "company" || page.company_id !== companyId || page.profile_id) {
          return json({ error: "Выберите свободную страницу мастера компании" }, 400);
        }
        const { error } = await admin.from("masters").update({ profile_id: userId }).eq("id", masterId);
        if (error) throw error;
      }
      const { error } = await admin.from("company_members").insert({
        profile_id: userId, company_id: companyId, role, master_id: role === "master" ? masterId : null,
      });
      if (error) throw error;
      const { error: roleError } = await admin.from("profiles").update({ platform_role: "pending" }).eq("id", userId);
      if (roleError) throw roleError;
    }
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось назначить роль" }, 400);
  }
});
