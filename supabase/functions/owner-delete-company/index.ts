import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin, anon } = clients();
    await requireOwner(req, admin, anon);
    const { companyId } = await req.json();
    if (typeof companyId !== "string" || !companyId) {
      return json({ error: "Не указана компания для удаления" }, 400);
    }

    const { data: company, error: companyError } = await admin
      .from("companies").select("id,name").eq("id", companyId).maybeSingle();
    if (companyError) throw companyError;
    if (!company) return json({ error: "Компания не найдена" }, 404);

    const { data: memberships, error: membersError } = await admin
      .from("company_members").select("profile_id").eq("company_id", companyId);
    if (membersError) throw membersError;
    const profileIds = [...new Set((memberships ?? []).map((item) => item.profile_id))];

    const { data: pages, error: pagesError } = await admin
      .from("masters").select("id").eq("company_id", companyId);
    if (pagesError) throw pagesError;
    const pageIds = (pages ?? []).map((page) => page.id);

    let pagesWithHistory = new Set<string>();
    if (pageIds.length) {
      const [{ data: bookings, error: bookingsError }, { data: services, error: servicesError }] = await Promise.all([
        admin.from("bookings").select("master_id").in("master_id", pageIds),
        admin.from("services").select("master_id").in("master_id", pageIds),
      ]);
      if (bookingsError) throw bookingsError;
      if (servicesError) throw servicesError;
      pagesWithHistory = new Set([
        ...(bookings ?? []).map((row) => row.master_id),
        ...(services ?? []).map((row) => row.master_id),
      ]);
    }

    const archivedPageIds = pageIds.filter((id) => pagesWithHistory.has(id));
    const deletablePageIds = pageIds.filter((id) => !pagesWithHistory.has(id));

    if (archivedPageIds.length) {
      const { error: archiveError } = await admin.from("masters")
        .update({ is_active: false, archived_at: new Date().toISOString() })
        .in("id", archivedPageIds);
      if (archiveError) throw archiveError;
    }
    if (deletablePageIds.length) {
      const { error: deletePagesError } = await admin.from("masters")
        .delete().in("id", deletablePageIds);
      if (deletePagesError) throw deletePagesError;
    }

    if (profileIds.length) {
      const { error: membershipsError } = await admin.from("company_members")
        .delete().eq("company_id", companyId);
      if (membershipsError) throw membershipsError;
      const { error: profileError } = await admin.from("profiles")
        .update({ platform_role: "pending" }).in("id", profileIds);
      if (profileError) throw profileError;
    }

    if (archivedPageIds.length) {
      const { error: deactivateError } = await admin.from("companies")
        .update({ is_active: false }).eq("id", companyId);
      if (deactivateError) throw deactivateError;
      return json({
        success: true,
        archived: true,
        archivedPages: archivedPageIds.length,
        deletedPages: deletablePageIds.length,
        unassignedAccounts: profileIds.length,
        message: "Компания отключена и сохранена в архиве, поскольку у её страниц есть услуги или история записей.",
      });
    }

    const { error: deleteCompanyError } = await admin.from("companies").delete().eq("id", companyId);
    if (deleteCompanyError) throw deleteCompanyError;
    return json({
      success: true,
      archived: false,
      deletedPages: deletablePageIds.length,
      unassignedAccounts: profileIds.length,
      message: "Компания и её страницы удалены.",
    });
  } catch (error) {
    console.error("owner-delete-company failed", error);
    return json({ error: error instanceof Error ? error.message : "Не удалось удалить компанию" }, 500);
  }
});
