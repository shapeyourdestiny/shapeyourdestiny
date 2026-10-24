import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request) {
  const { email } = await request.json();

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  const trimmedEmail = email.trim().toLowerCase();

  const adminClient = createAdminClient();

  // Use the fixed site URL
  const siteUrl = "https://shapeyourdestiny.co";

  // Generate the recovery link using admin API
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: trimmedEmail,
    options: {
      redirectTo: `${siteUrl}/reset-password`,
    },
  });

  if (error) {
    console.error("Password reset link generation error:", error);
    // Don't reveal if email exists or not - return success either way
    return Response.json({ success: true });
  }

  // The action_link goes to Supabase's verify endpoint
  // We need to extract the token and create a direct link
  const actionLink = data.properties.action_link;

  // Parse the token from the Supabase link and create our own link
  // The link format is: https://xxx.supabase.co/auth/v1/verify?token=TOKEN&type=recovery&redirect_to=URL
  const url = new URL(actionLink);
  const token = url.searchParams.get("token");
  const type = url.searchParams.get("type");

  // Create a link that goes directly to our reset page with the token
  const resetLink = `${siteUrl}/auth/confirm?token_hash=${token}&type=${type}&next=/reset-password`;

  // Send the email directly through Resend
  try {
    await sendPasswordResetEmail({
      to: trimmedEmail,
      resetLink: resetLink,
    });
  } catch (emailError) {
    console.error("Failed to send password reset email:", emailError);
    // Still return success to not reveal email existence
    return Response.json({ success: true });
  }

  return Response.json({ success: true });
}
