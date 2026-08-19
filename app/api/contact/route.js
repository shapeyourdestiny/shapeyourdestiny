import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, org, message, reason } = body;

    // For now, just log the submission
    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    console.log("Contact form submission:", {
      name,
      email,
      phone,
      org,
      message,
      reason,
      timestamp: new Date().toISOString(),
    });

    // In production, you would send an email here
    // Example with Resend:
    // await resend.emails.send({
    //   from: 'Contact Form <noreply@shapeyourdestiny.co>',
    //   to: 'destiny@shapeyourdestiny.co',
    //   subject: `New ${reason} inquiry from ${name}`,
    //   text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nOrganization: ${org}\n\nMessage:\n${message}`,
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to process submission" },
      { status: 500 }
    );
  }
}
