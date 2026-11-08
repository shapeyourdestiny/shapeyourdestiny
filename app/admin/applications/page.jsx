import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplications, getHiringSettings } from "@/lib/admin/applications";
import ApplicationsClient from "./ApplicationsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Applications | Admin | Shape Your Destiny",
};

export default async function AdminApplicationsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin-login");
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const [applications, settings] = await Promise.all([
    getApplications(),
    getHiringSettings(),
  ]);

  return (
    <ApplicationsClient
      applications={applications}
      settings={settings}
    />
  );
}
