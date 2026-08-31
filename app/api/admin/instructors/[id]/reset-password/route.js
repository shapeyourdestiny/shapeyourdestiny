import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request, { params }) {
  const supabase = await createClient();
  const { id } = await params;

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the instructor's email
  const adminClient = createAdminClient();
  const { data: authUser, error: userError } = await adminClient.auth.admin.getUserById(id);

  if (userError || !authUser?.user?.email) {
    console.error("Error getting user:", userError);
    return Response.json({ error: "Failed to find user" }, { status: 404 });
  }

  // Send password reset email
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    authUser.user.email,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password` }
  );

  if (resetError) {
    console.error("Error sending reset email:", resetError);
    return Response.json({ error: "Failed to send reset email" }, { status: 500 });
  }

  return Response.json({ success: true, email: authUser.user.email });
}
