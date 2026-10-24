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
  // This redirects to a client-side page that can handle the hash fragments
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: trimmedEmail,
    options: {
      redirectTo: `${siteUrl}/auth/handle-reset`,
    },
  });

  if (error) {
    console.error("Password reset link generation error:", error);
    // Don't reveal if email exists or not - return success either way
    return Response.json({ success: true });
  }

  // Use the original Supabase action link - it handles token verification
  const resetLink = data.properties.action_link;

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
