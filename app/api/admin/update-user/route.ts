import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

/**
 * Updates an existing teammate's name/email/password, invoked from
 * /dashboard/users by an admin or manager. Uses the service-role key
 * server-side because changing another user's email or password requires
 * admin privileges the anon key doesn't have.
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

  let body: { userId?: unknown; firstName?: unknown; lastName?: unknown; email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { userId, firstName, lastName, email, password } = body;
  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  if (typeof firstName !== "string" || !firstName.trim() || typeof lastName !== "string" || !lastName.trim()) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (password !== undefined && password !== "" && (typeof password !== "string" || password.length < 6)) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

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

  const adminClient = createClient(SUPABASE_URL, serviceKey);

  // A manager cannot edit an admin's account (email/password/name) — same
  // boundary as creating and role-changing admin accounts.
  if (callerRole === "manager") {
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (targetProfile?.role === "admin") {
      return NextResponse.json({ error: "Only an admin can edit an admin account" }, { status: 403 });
    }
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`;
  const updatePayload: { email?: string; password?: string; user_metadata: Record<string, string> } = {
    user_metadata: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName },
  };
  if (email.trim()) updatePayload.email = email.trim();
  if (password && password.length >= 6) updatePayload.password = password;

  const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, updatePayload);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message || "Could not update account" }, { status: 400 });
  }

  const { error: profileErr } = await adminClient
    .from("profiles")
    .update({ first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (profileErr) {
    console.error("[update-user] profile update failed", profileErr);
  }

  return NextResponse.json({ ok: true });
}
