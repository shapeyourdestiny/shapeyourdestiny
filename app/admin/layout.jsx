import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOpenIncidentCount } from "@/lib/incidents/queries";
import { getAdminInbox } from "@/lib/admin/inbox";
import { getPeriodsNeedingApprovalCount } from "@/lib/payroll/compute";
import { getNewApplicationsCount } from "@/lib/admin/applications";
import Sidebar from "./components/Sidebar";
import styles from "./layout.module.css";

export const metadata = {
  title: "Admin | Shape Your Destiny",
  description: "Admin dashboard for Shape Your Destiny.",
};

export default async function AdminLayout({ children }) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/instructor-login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/instructor/dashboard");
  }

  // Get incident count for badge
  let incidentCount = 0;
  try {
    incidentCount = await getOpenIncidentCount();
  } catch {
    // incident_reports table might not exist yet
  }

  // Get inbox count for badge
  let inboxCount = 0;
  try {
    const inboxData = await getAdminInbox();
    inboxCount = inboxData.totalPending;
  } catch {
    // tables might not exist yet
  }

  // Get payroll count for badge
  let payrollCount = 0;
  try {
    payrollCount = await getPeriodsNeedingApprovalCount();
  } catch {
    // tables might not exist yet
  }

  // Get applications count for badge (new applications not opened by any admin)
  let applicationsCount = 0;
  try {
    applicationsCount = await getNewApplicationsCount();
  } catch {
    // table might not exist yet
  }

  return (
    <div className={styles.layout}>
      <Sidebar profile={profile} incidentCount={incidentCount} inboxCount={inboxCount} payrollCount={payrollCount} applicationsCount={applicationsCount} />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
