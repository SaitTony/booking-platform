import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { admin, anon } = clients();
    const actor = await requireOwner(req, admin, anon);
    const body = await req.json();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const temporaryPassword = String(body.temporaryPassword ?? "");
    const role = String(body.role ?? "");
    const companyId = body.companyId ?? null;
    const companyName = String(body.companyName ?? "").trim();
    const companySlug = String(body.companySlug ?? "").trim();
    const pageName = String(body.pageName ?? fullName).trim();
    const pageSlug = String(body.pageSlug ?? "").trim();
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+7[0-9]{10}$/.test(phone) || temporaryPassword.length < 6) {
      return json({ error: "Укажите имя, корректный email, телефон в формате +7 и ровно 10 цифр после кода страны, а также временный пароль длиной от 6 символов" }, 400);
    }
    if (!["admin", "master", "master_pro"].includes(role)) {
      return json({ error: "Выберите роль сотрудника" }, 400);
    }
    if (role === "admin" && (!companyName || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(companySlug))) {
      return json({ error: "Для Admin укажите название компании" }, 400);
    }
    if (role === "master" && typeof companyId !== "string") {
      return json({ error: "Для Master необходимо выбрать компанию" }, 400);
    }
    if (role === "master_pro" && companyId !== null) {
      return json({ error: "Master_pro получает индивидуальную страницу без компании" }, 400);
    }
    if ((role === "master" || role === "master_pro") &&
        (!pageName || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pageSlug))) {
      return json({ error: "Не удалось сформировать страницу мастера" }, 400);
    }
    const { data, error } = await admin.auth.admin.createUser({
      email, password: temporaryPassword, email_confirm: true,
      user_metadata: { full_name: fullName, phone_e164: phone },
    });
    if (error) throw error;
    const { error: profileError } = await admin.from("profiles").update({
      full_name: fullName, email, phone_e164: phone, platform_role: "pending", force_password_change: true,
    }).eq("id", data.user.id);
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    const { data: assignment, error: roleError } = await admin.rpc("owner_create_user_assignment", {
      p_actor_id: actor.id,
      p_user_id: data.user.id,
      p_role: role,
      p_company_id: role === "master" ? companyId : null,
      p_company_name: role === "admin" ? companyName : null,
      p_company_slug: role === "admin" ? companySlug : null,
      p_page_name: role === "master" || role === "master_pro" ? pageName : null,
      p_page_slug: role === "master" || role === "master_pro" ? pageSlug : null,
    });
    if (roleError) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
      if (cleanupError) console.error("create-user rollback could not remove Auth user", cleanupError);
      throw roleError;
    }
    return json({ userId: data.user.id, phone, status: "active", role, assignment });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось создать учётную запись" }, 400);
  }
});
