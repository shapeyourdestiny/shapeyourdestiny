import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  console.log("check-role API called");

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log("User from session:", user?.id, "Error:", userError?.message);

  if (!user) {
    return Response.json({ role: null, error: "No user session" });
  }

  // Use admin client to bypass RLS
  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  console.log("Profile result:", profile, "Error:", profileError?.message);

  return Response.json({ role: profile?.role || "instructor" });
}
