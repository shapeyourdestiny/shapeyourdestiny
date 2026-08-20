import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email/index";

function generateInviteCode() {
  // Format: SYD-XXXX-XXXX (uppercase alphanumeric)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars like 0/O, 1/I
  let code = "SYD-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += "-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request) {
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

  const { email, role } = await request.json();

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  if (!role || !["instructor", "admin"].includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  const code = generateInviteCode();

  const { error: insertError } = await supabase
    .from("invite_codes")
    .insert({ code, role, sent_to: email, sent_at: new Date().toISOString() });

  if (insertError) {
    console.error("Insert error:", insertError);
    return Response.json({ error: "Failed to create invite code" }, { status: 500 });
  }

  // Send the invite email
  try {
    await sendInviteEmail({ to: email, code, role });
  } catch (emailError) {
    console.error("Email error:", emailError);
    // Code was created but email failed - still return success with warning
    return Response.json({ success: true, code, emailFailed: true });
  }

  return Response.json({ success: true, code });
}
