import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// DELETE - Remove instructor (deletes profile and auth user)
// Only allowed for instructors with 0 session history
export async function DELETE(request, { params }) {
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

  // Check session count - only allow delete if 0 sessions
  const { count, error: countError } = await supabase
    .from("class_assignments")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", id);

  if (countError) {
    console.error("Error checking session count:", countError);
    return Response.json({ error: "Failed to check session history" }, { status: 500 });
  }

  if (count > 0) {
    return Response.json(
      { error: `Cannot delete instructor with ${count} session(s) of history. Use archive instead.` },
      { status: 400 }
    );
  }

  // Use admin client to delete
  const adminClient = createAdminClient();

  // Clear invite_codes.used_by reference
  await adminClient
    .from("invite_codes")
    .update({ used_by: null })
    .eq("used_by", id);

  // Delete auth user (profile will cascade delete due to foreign key)
  const { error: authError } = await adminClient.auth.admin.deleteUser(id);

  if (authError) {
    console.error("Error deleting auth user:", authError);
    return Response.json({ error: "Failed to delete user: " + authError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

// PATCH - Update instructor status (active/archived)
export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  // Support both old 'archived' boolean and new 'status' field
  let status;
  if (body.status) {
    status = body.status;
  } else if (body.archived !== undefined) {
    // Backwards compatibility: convert archived boolean to status
    status = body.archived ? "archived" : "active";
  } else {
    return Response.json({ error: "Missing status or archived field" }, { status: 400 });
  }

  // Validate status value
  if (!["active", "invited", "archived"].includes(status)) {
    return Response.json({ error: "Invalid status value" }, { status: 400 });
  }

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

  // Use admin client to update
  const adminClient = createAdminClient();

  // Try updating status column first, fall back to archived if it doesn't exist
  const { error: statusError } = await adminClient
    .from("profiles")
    .update({ status })
    .eq("id", id);

  // Check if error is about missing column
  const isColumnError = statusError && (
    statusError.message?.includes("status") ||
    statusError.message?.includes("column") ||
    statusError.code === "42703"
  );

  if (isColumnError) {
    // status column doesn't exist, use archived instead
    const archived = status === "archived";
    const { error: archivedError } = await adminClient
      .from("profiles")
      .update({ archived })
      .eq("id", id);

    if (archivedError) {
      console.error("Error updating profile:", archivedError);
      return Response.json({ error: "Failed to update instructor" }, { status: 500 });
    }
  } else if (statusError) {
    console.error("Error updating profile:", statusError);
    return Response.json({ error: "Failed to update instructor" }, { status: 500 });
  }

  return Response.json({ success: true, status });
}
