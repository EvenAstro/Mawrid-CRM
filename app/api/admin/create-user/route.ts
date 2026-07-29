import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

/**
 * Creates a new team member account with a set password + role, invoked only
 * from /dashboard/users by an admin or manager. Uses the service-role key
 * server-side (never exposed to the browser) because setting a user's
 * password directly requires supabase.auth.admin.createUser, which the anon
 * key cannot call.
 */
export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerToken) {
    return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
  }

  let body: { firstName?: unknown; lastName?: unknown; email?: unknown; password?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { firstName, lastName, email, password, role } = body;
  if (
    typeof firstName !== "string" || !firstName.trim() ||
    typeof lastName !== "string" || !lastName.trim() ||
    typeof email !== "string" || !email.trim() ||
    typeof password !== "string" || password.length < 6 ||
    typeof role !== "string" || !["admin", "manager", "sales"].includes(role)
  ) {
    return NextResponse.json({ error: "Invalid or missing fields" }, { status: 400 });
  }

  // Verify the caller is authenticated and is an admin/manager, using their
  // own token against the anon-key client (so RLS applies normally).
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });
  const { data: callerUser, error: callerErr } = await callerClient.auth.getUser(callerToken);
  if (callerErr || !callerUser.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: callerProfile } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", callerUser.user.id)
    .maybeSingle();
  const callerRole = callerProfile?.role;
  if (callerRole !== "admin" && callerRole !== "manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  // Managers can create anything except admin accounts.
  if (callerRole === "manager" && role === "admin") {
    return NextResponse.json({ error: "Only an admin can create admin accounts" }, { status: 403 });
  }

  const adminClient = createClient(SUPABASE_URL, serviceKey);
  const fullName = `${firstName.trim()} ${lastName.trim()}`;
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName },
  });
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message || "Could not create account" }, { status: 400 });
  }

  const { error: profileErr } = await adminClient.from("profiles").upsert({
    id: created.user.id,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    email: email.trim(),
    role,
    updated_at: new Date().toISOString(),
  });
  if (profileErr) {
    console.error("[create-user] profile upsert failed", profileErr);
  }

  return NextResponse.json({ id: created.user.id });
}
