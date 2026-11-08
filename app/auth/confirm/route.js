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
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (error) {
    console.error("Token verification error:", error);
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
  }

  // Successfully verified - redirect to the safe next page
  return NextResponse.redirect(getSafeRedirect(next, origin));
}
