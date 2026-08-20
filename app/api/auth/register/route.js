import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const { inviteCode, fullName, email, password } = await request.json();

  if (!inviteCode || !fullName || !email || !password) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Look up the invite code
  const { data: inviteData, error: inviteError } = await supabase
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

  // 2. Create the account
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

  // 3. Insert profile - use admin-level insert by temporarily bypassing RLS
  // We do this in a transaction-like manner
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      full_name: fullName.trim(),
      role: inviteData.role,
    });

  if (profileError) {
    console.error("Profile insert error:", profileError);
    return Response.json({ error: "Failed to create profile: " + profileError.message }, { status: 500 });
  }

  // 4. Mark invite code as used
  await supabase
    .from("invite_codes")
    .update({ used_by: userId })
    .eq("id", inviteData.id);

  return Response.json({ success: true });
}
