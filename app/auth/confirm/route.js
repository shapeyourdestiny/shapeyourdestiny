import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  // Successfully verified - redirect to the next page
  return NextResponse.redirect(`${origin}${next}`);
}
