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
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    },
  });

  if (error) {
    console.error("Password reset link generation error:", error);
    // Don't reveal if email exists or not - return success either way
    return Response.json({ success: true });
  }

  // Send the email directly through Resend
  try {
    await sendPasswordResetEmail({
      to: trimmedEmail,
      resetLink: data.properties.action_link,
    });
  } catch (emailError) {
    console.error("Failed to send password reset email:", emailError);
    // Still return success to not reveal email existence
    return Response.json({ success: true });
  }

  return Response.json({ success: true });
}
