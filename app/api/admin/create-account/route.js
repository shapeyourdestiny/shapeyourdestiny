import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(request) {
  const supabase = await createClient();

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

  const { email, password, fullName, role } = await request.json();

  if (!email || !password || !fullName || !role) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  if (!["instructor", "admin"].includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Check if user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === email);

  let userId;

  if (existingUser) {
    // Check if they have a profile
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", existingUser.id)
      .single();

    if (existingProfile) {
      return Response.json({ error: "A user with this email address has already been registered" }, { status: 400 });
    }

    // User exists but no profile - update their password and reuse
    const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
    });

    if (updateError) {
      console.error("Error updating existing user:", updateError);
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    userId = existingUser.id;
  } else {
    // Create new auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Error creating user:", authError);
      return Response.json({ error: authError.message }, { status: 500 });
    }

    userId = authData.user.id;
  }

  // Create profile
  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({
      id: userId,
      full_name: fullName.trim(),
      role: role,
    });

  if (profileError) {
    console.error("Error creating profile:", profileError);
    // Try to clean up the auth user
    await adminClient.auth.admin.deleteUser(userId);
    return Response.json({ error: "Failed to create profile: " + profileError.message }, { status: 500 });
  }

  // Send welcome email
  try {
    await sendWelcomeEmail({
      to: email,
      fullName: fullName.trim(),
      role,
    });
  } catch (emailError) {
    console.error("Failed to send welcome email:", emailError);
    // Don't fail the request if email fails - account was still created
  }

  return Response.json({ success: true, userId });
}
