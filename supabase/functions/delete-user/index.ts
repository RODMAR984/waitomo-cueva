// Edge Function: eliminar cuenta del usuario (auth + datos).
// El usuario envía su JWT; se valida y se borra con service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !user?.id) {
    return new Response(
      JSON.stringify({ error: "Invalid token or user not found" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const userId = user.id;
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1) Borrar primero el usuario en Auth. Si falla, no tocamos datos (evita perfil borrado + auth vivo).
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("auth.admin.deleteUser error", deleteError);
    return new Response(
      JSON.stringify({ error: deleteError.message || "Failed to delete user" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // 2) Luego borrar datos (user ya no existe en auth, no podrá refrescar sesión).
  try {
    await supabaseAdmin.from("user_abonos").delete().eq("user_id", userId);
  } catch (e) {
    console.error("user_abonos delete error", e);
  }
  try {
    const { error: profErr } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (profErr) console.error("profiles delete error", profErr);
  } catch (e) {
    console.error("profiles delete error", e);
  }

  return new Response(
    JSON.stringify({ ok: true, message: "Account deleted" }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
