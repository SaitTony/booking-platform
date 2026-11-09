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
    const masterId = body.masterId ?? null;
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+7[0-9]{10}$/.test(phone) || temporaryPassword.length < 6) {
      return json({ error: "Укажите имя, корректный email, телефон в формате +7 и ровно 10 цифр после кода страны, а также временный пароль длиной от 6 символов" }, 400);
    }
    if (!["admin", "master", "master_pro"].includes(role)) {
      return json({ error: "Выберите роль сотрудника" }, 400);
    }
    if ((role === "admin" || role === "master") && typeof companyId !== "string") {
      return json({ error: "Для роли сотрудника компании необходимо выбрать компанию" }, 400);
    }
    if ((role === "master" || role === "master_pro") && typeof masterId !== "string") {
      return json({ error: "Для выбранной роли необходимо выбрать страницу мастера" }, 400);
    }
    if (role === "admin" && masterId !== null) {
      return json({ error: "Администратору компании не назначается страница мастера" }, 400);
    }
    if (role === "master_pro" && companyId !== null) {
      return json({ error: "Master_pro назначается на индивидуальную страницу" }, 400);
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
    const { error: roleError } = await admin.rpc("owner_assign_user_role", {
      p_actor_id: actor.id,
      p_user_id: data.user.id,
      p_role: role,
      p_company_id: companyId,
      p_master_id: masterId,
    });
    if (roleError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw roleError;
    }
    return json({ userId: data.user.id, phone, status: "active", role });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось создать учётную запись" }, 400);
  }
});
