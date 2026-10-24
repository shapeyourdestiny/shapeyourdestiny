import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";

export async function POST(request) {
  const { inviteCode, fullName, phone, email, password, avatarUrl } = await request.json();

  if (!inviteCode || !fullName || !phone || !email || !password) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Use admin client for DB operations (bypasses RLS)
  const adminClient = createAdminClient();

  // 1. Look up the invite code
  // Try with new columns first, fall back to basic query
  let inviteData = null;
  let inviteError = null;

  const { data: fullData, error: fullError } = await adminClient
    .from("invite_codes")
    .select("id, role, used_by, profile_id, expires_at")
    .eq("code", inviteCode.trim())
    .maybeSingle();

  if (fullError && fullError.message?.includes("column")) {
    // New columns don't exist, try basic query
    const { data: basicData, error: basicError } = await adminClient
      .from("invite_codes")
      .select("id, role, used_by")
      .eq("code", inviteCode.trim())
      .maybeSingle();

    inviteData = basicData;
    inviteError = basicError;
  } else {
    inviteData = fullData;
    inviteError = fullError;
  }

  if (inviteError) {
    console.error("Invite code lookup error:", inviteError);
    return Response.json({ error: "Failed to verify invite code" }, { status: 500 });
  }

  if (!inviteData) {
    return Response.json({ error: "Invalid invite code" }, { status: 400 });
  }

  if (inviteData.used_by) {
    return Response.json({ error: "This invite code has already been used" }, { status: 400 });
  }

  // Check expiry if set (column may not exist in older schema)
  if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
    return Response.json({ error: "This invite code has expired" }, { status: 400 });
  }

  // profile_id may not exist in older schema
  const profileId = inviteData.profile_id || null;

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

  // 3. Handle profile creation or linking
  let profileLinked = false;

  if (profileId) {
    // This invite is linked to a pre-created profile - update it instead of creating new
    const updateData = {
      user_id: userId,
      status: "active",
      phone: phone.trim(),
    };

    // Update name if provided (may differ from pre-created name)
    if (fullName.trim()) {
      updateData.full_name = fullName.trim();
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", profileId);

    if (updateError) {
      console.error("Profile link error:", updateError);
      return Response.json({ error: "Failed to link profile: " + updateError.message }, { status: 500 });
    }

    profileLinked = true;
  } else {
    // Regular flow - create new profile
    const profileData = {
      id: userId,
      user_id: userId,
      full_name: fullName.trim(),
      phone: phone.trim(),
      role: inviteData.role,
      status: "active",
    };

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
  }

  // 4. Mark invite code as used
  await adminClient
    .from("invite_codes")
    .update({ used_by: userId })
    .eq("id", inviteData.id);

  // 5. Revalidate staff page cache
  revalidateTag("staff");

  return Response.json({
    success: true,
    profileLinked,
    profileId: profileLinked ? profileId : userId,
  });
}
