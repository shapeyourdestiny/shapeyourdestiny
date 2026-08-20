import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email/index";

export async function POST(request, { params }) {
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

  // Get the invite code
  const { data: invite, error: fetchError } = await supabase
    .from("invite_codes")
    .select("code, role, sent_to, used_by")
    .eq("id", id)
    .single();

  if (fetchError || !invite) {
    return Response.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.used_by) {
    return Response.json({ error: "Invite already used" }, { status: 400 });
  }

  if (!invite.sent_to) {
    return Response.json({ error: "No email address for this invite" }, { status: 400 });
  }

  // Resend the email
  try {
    await sendInviteEmail({
      to: invite.sent_to,
      code: invite.code,
      role: invite.role,
    });
  } catch (emailError) {
    console.error("Email error:", emailError);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }

  // Update sent_at timestamp
  await supabase
    .from("invite_codes")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);

  return Response.json({ success: true });
}
