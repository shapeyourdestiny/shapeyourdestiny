import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({
      authenticated: false,
      error: userError?.message || "No user"
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return Response.json({
    authenticated: true,
    user: { id: user.id, email: user.email },
    profile,
    profileError: profileError?.message,
  });
}
