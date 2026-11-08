import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
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
