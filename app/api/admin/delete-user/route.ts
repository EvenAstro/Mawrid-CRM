import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { fetchProfileRole } from "@/lib/profiles";

/**
 * Deletes a team member's account entirely (admin only), invoked from
 * /dashboard/users. Uses the service-role key server-side because deleting
 * an auth user requires admin privileges the anon key doesn't have.
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

  let body: { userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { userId } = body;
  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });
  const { data: callerUser, error: callerErr } = await callerClient.auth.getUser(callerToken);
  if (callerErr || !callerUser.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const callerRole = await fetchProfileRole(callerClient, callerUser.user.id);
  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Only an admin can delete accounts" }, { status: 403 });
  }
  if (userId === callerUser.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const adminClient = createClient(SUPABASE_URL, serviceKey);
  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message || "Could not delete account" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
