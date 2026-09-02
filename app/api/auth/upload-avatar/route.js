import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const inviteCode = formData.get("inviteCode");

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (!inviteCode) {
    return Response.json({ error: "Invite code required" }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: "Invalid file type" }, { status: 400 });
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Verify invite code is valid and unused
  const { data: inviteData, error: inviteError } = await adminClient
    .from("invite_codes")
    .select("id, used_by")
    .eq("code", inviteCode.trim())
    .single();

  if (inviteError || !inviteData) {
    return Response.json({ error: "Invalid invite code" }, { status: 400 });
  }

  if (inviteData.used_by) {
    return Response.json({ error: "Invite code already used" }, { status: 400 });
  }

  // Generate unique filename
  const ext = file.name.split(".").pop() || "jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filename = `pending-${inviteData.id}-${timestamp}-${random}.${ext}`;

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Supabase storage
  const { data: uploadData, error: uploadError } = await adminClient
    .storage
    .from("avatar-photos")
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return Response.json({ error: "Failed to upload photo" }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = adminClient
    .storage
    .from("avatar-photos")
    .getPublicUrl(filename);

  return Response.json({ url: urlData.publicUrl });
}
