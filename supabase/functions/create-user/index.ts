import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { admin, anon } = clients();
    await requireOwner(req, admin, anon);
    const body = await req.json();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const temporaryPassword = String(body.temporaryPassword ?? "");
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+7[0-9]{10}$/.test(phone) || temporaryPassword.length < 6) {
      return json({ error: "Укажите имя, корректный email, телефон в формате +7 и ровно 10 цифр после кода страны, а также временный пароль длиной от 6 символов" }, 400);
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
    return json({ userId: data.user.id, phone, status: "pending_role" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Не удалось создать учётную запись" }, 400);
  }
});
