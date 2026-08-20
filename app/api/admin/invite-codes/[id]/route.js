import { createClient } from "@/lib/supabase/server";

export async function DELETE(request, { params }) {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Only delete if not already used
  const { error: deleteError } = await supabase
    .from("invite_codes")
    .delete()
    .eq("id", id)
    .is("used_by", null);

  if (deleteError) {
    return Response.json({ error: "Failed to cancel invite" }, { status: 500 });
  }

  return Response.json({ success: true });
}
