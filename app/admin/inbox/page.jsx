import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminInbox } from "@/lib/admin/inbox";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inbox | Admin | Shape Your Destiny",
};

export default async function AdminInboxPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin-login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  const inboxData = await getAdminInbox();

  return <InboxClient inboxData={inboxData} />;
}
