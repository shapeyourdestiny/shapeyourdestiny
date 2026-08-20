import { NextResponse } from "next/server";
import { sendContactNotification, sendContactConfirmation } from "@/lib/email/index";

const REASON_LABELS = {
  school: "Bring the program to my school",
  corporate: "Corporate wellness for my staff",
  general: "General questions",
  support: "Support with an existing program",
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, org, message, reason } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    const reasonLabel = REASON_LABELS[reason] || reason;

    // Send internal notification to team
    try {
      await sendContactNotification({
        name,
        email,
        phone,
        org,
        message,
        reason,
        reasonLabel,
      });
    } catch (error) {
      console.error("Failed to send contact notification:", error);
      return NextResponse.json(
        { error: "Failed to process submission" },
        { status: 500 }
      );
    }

    // Send confirmation to submitter (non-critical - log failure but don't fail request)
    try {
      await sendContactConfirmation({
        name,
        email,
        message,
        reasonLabel,
      });
    } catch (error) {
      console.error("Failed to send confirmation email to submitter:", error);
      // Don't fail the request - the inquiry was still received
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to process submission" },
      { status: 500 }
    );
  }
}
