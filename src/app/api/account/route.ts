import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/**
 * Deletes the signed-in user and everything they own.
 *
 * Two deliberate properties:
 *
 * 1. The id deleted is the one on the verified session, never one sent by the
 *    client. getUser() revalidates the token with Supabase rather than
 *    trusting the cookie, so this endpoint cannot be pointed at anyone else.
 * 2. Removing the auth user is enough. Every table references auth.users with
 *    on delete cascade, so profiles, templates, workouts, sets, bodyweight and
 *    protein all go with it in one transaction.
 *
 * The service-role key is read here and only here (plus the seed script), both
 * of which are server-only modules.
 */
export async function DELETE() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Account deletion needs SUPABASE_SERVICE_ROLE_KEY on the server. See README.md.",
      },
      { status: 500 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear the session cookies on the way out.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
