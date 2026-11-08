import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const inboxData = await getAdminInbox();

  return <InboxClient inboxData={inboxData} />;
}
