import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Allowed redirect paths (prevent open redirect)
const ALLOWED_REDIRECTS = [
  "/",
  "/instructor/dashboard",
  "/instructor/profile",
  "/instructor/inbox",
  "/instructor/forms",
  "/instructor/past",
  "/instructor/incident-report",
  "/admin/dashboard",
  "/admin/instructors",
  "/admin/schedule",
  "/admin/programs",
  "/admin/payroll",
  "/admin/inbox",
  "/admin/applications",
  "/admin/updates",
  "/admin/incident-reports",
];

function getSafeRedirect(next, origin) {
  // Default to home
  if (!next || next === "/") return `${origin}/`;

  // Check if path starts with any allowed path
  const isAllowed = ALLOWED_REDIRECTS.some(
    (allowed) => next === allowed || next.startsWith(allowed + "/")
  );

  if (isAllowed) {
    return `${origin}${next}`;
  }

  // Default to home for invalid paths
  return `${origin}/`;
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  // Handle code exchange (OAuth/PKCE flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(getSafeRedirect(next, origin));
    }
    console.error("Code exchange error:", error);
  }

  // Handle token hash verification (email link flow - recovery, signup confirmation, etc.)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(getSafeRedirect(next, origin));
    }
    console.error("Token verification error:", error);
  }

  // Return the user to an error page
  return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
}
