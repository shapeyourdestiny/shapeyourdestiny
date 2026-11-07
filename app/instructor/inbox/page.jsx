import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInstructorInbox } from "@/lib/instructor/inbox";
import InboxClient from "./InboxClient";

export const metadata = {
  title: "Inbox | Shape Your Destiny",
  description: "Your messages and updates.",
};

export default async function InstructorInboxPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/instructor-login");
  }

  let inboxData;
  try {
    inboxData = await getInstructorInbox();
  } catch (error) {
    console.error("Error fetching inbox:", error);
    inboxData = {
      updates: [],
      shoutOuts: [],
      unreadUpdates: 0,
      unreadShoutOuts: 0,
      sharedNotes: [],
    };
  }

  return <InboxClient inboxData={inboxData} />;
}
