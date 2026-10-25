import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Proxy (what earlier versions of Next called middleware).
 *
 * Two jobs: keep the Supabase session cookie fresh, and keep signed-out
 * visitors out of the app. It is an optimistic check only. Every table is
 * still protected by Row Level Security, and the account-deletion route
 * re-verifies the session server-side, so a bypass here reaches no data.
 *
 * Offline requests never get here at all: the service worker answers them
 * from cache, which is exactly what makes the app open in a basement gym.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/check-email",
  "/auth",
  "/offline",
];

const isPublic = (pathname: string) =>
  PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  // Without credentials there is nothing to check and no session to refresh.
  // The app renders its "not configured" guidance instead of redirect-looping.
  if (!isSupabaseConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser revalidates the token with Supabase rather than trusting the
  // cookie's contents, and refreshes it when it is close to expiry.
  //
  // A network failure is treated differently from a rejected session. If
  // Supabase cannot be reached at all, the request is let through rather than
  // bounced to /login: this is a local-first app, and an outage must not lock
  // someone out of a workout that is already on their phone. Nothing is
  // exposed by doing so, because the gate here is optimistic either way. Row
  // Level Security decides what any request can actually read, the app shell
  // re-checks the session on the client, and no session means no data.
  //
  // A real "this token is not valid" answer still redirects, as it should.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    // supabase-js returns transport failures rather than throwing them.
    if (result.error && isAuthRetryableFetchError(result.error)) return response;
    user = result.data.user;
  } catch {
    return response;
  }

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // So a shared link to /progress still lands there after signing in.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the PWA files. The service worker
     * and the manifest in particular must never be redirected: an install
     * check that lands on /login breaks installability.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)",
  ],
};
