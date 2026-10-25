import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Lands every emailed link: sign-up confirmation and password recovery.
 *
 * Exchanges the one-time token for a session cookie and forwards the user on.
 * Done server-side so the token never has to survive a client render, and so
 * the session cookie is set before the destination page loads.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const requested = searchParams.get("next");

  // Only same-origin paths, so a crafted link cannot bounce the user off-site
  // with a fresh session in hand.
  const next = requested && requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/today";

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, origin));

  if (!isSupabaseConfigured) return fail("Supabase is not configured.");
  if (!tokenHash || !type) return fail("That link is missing information.");

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) return fail("That link has expired or was already used.");

  return NextResponse.redirect(new URL(next, origin));
}
