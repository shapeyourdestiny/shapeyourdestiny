import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const { email } = await request.json();

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  const trimmedEmail = email.trim().toLowerCase();

  const supabase = await createClient();

  // Get the origin from the request headers
  const origin = request.headers.get("origin") || "https://shapeyourdestiny.co";

  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("Password reset error:", error);
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ success: true });
}
