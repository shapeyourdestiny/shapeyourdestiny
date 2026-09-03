import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request) {
  const { inviteCode, fullName, phone, email, password, cprExpires, foodHandlerExpires, avatarUrl } = await request.json();

  if (!inviteCode || !fullName || !phone || !email || !password) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Use admin client for DB operations (bypasses RLS)
  const adminClient = createAdminClient();

  // 1. Look up the invite code
  const { data: inviteData, error: inviteError } = await adminClient
    .from("invite_codes")
    .select("id, role, used_by")
    .eq("code", inviteCode.trim())
    .single();

  if (inviteError || !inviteData) {
    return Response.json({ error: "Invalid invite code" }, { status: 400 });
  }

  if (inviteData.used_by) {
    return Response.json({ error: "This invite code has already been used" }, { status: 400 });
  }

  // 2. Create the account using the regular server client for auth
  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return Response.json({ error: signUpError.message }, { status: 400 });
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    return Response.json({ error: "Account creation failed" }, { status: 500 });
  }

  // 3. Insert profile using admin client (bypasses RLS)
  const profileData = {
    id: userId,
    full_name: fullName.trim(),
    phone: phone.trim(),
    role: inviteData.role,
  };

  // Add certification dates if the columns exist (may need migration)
  if (cprExpires) {
    profileData.cpr_expiration = cprExpires;
  }
  if (foodHandlerExpires) {
    profileData.food_handler_expiration = foodHandlerExpires;
  }
  if (avatarUrl) {
    profileData.avatar_url = avatarUrl;
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .insert(profileData);

  if (profileError) {
    console.error("Profile insert error:", profileError);
    return Response.json({ error: "Failed to create profile: " + profileError.message }, { status: 500 });
  }

  // 4. Mark invite code as used
  await adminClient
    .from("invite_codes")
    .update({ used_by: userId })
    .eq("id", inviteData.id);

  return Response.json({ success: true });
}
