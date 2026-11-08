import { clients, corsHeaders, json, requireOwner } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { admin, anon } = clients();
    await requireOwner(req, admin, anon);
    const body = await req.json();
    const fullName = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const temporaryPassword = String(body.temporaryPassword ?? "");
    if (!fullName || !/^\+[1-9]\d{7,14}$/.test(phone) || temporaryPassword.length < 10) {
      return json({ error: "Укажите имя, телефон в формате E.164 и временный пароль длиной от 10 символов" }, 400);
    }
    const { data, error } = await admin.auth.admin.createUser({
      phone, password: temporaryPassword, phone_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    const { error: profileError } = await admin.from("profiles").update({
      full_name: fullName, phone_e164: phone, platform_role: "pending", force_password_change: true,
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
