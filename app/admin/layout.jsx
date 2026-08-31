import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminCoverageCount } from "@/lib/coverage/queries";
import { getOpenIncidentCount } from "@/lib/incidents/queries";
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

  // Get coverage count for badge
  let coverageCount = 0;
  try {
    coverageCount = await getAdminCoverageCount();
  } catch (e) {
    // coverage_requests table might not exist yet
    console.error("Error fetching coverage count:", e);
  }

  // Get incident count for badge
  let incidentCount = 0;
  try {
    incidentCount = await getOpenIncidentCount();
  } catch (e) {
    // incident_reports table might not exist yet
    console.error("Error fetching incident count:", e);
  }

  return (
    <div className={styles.layout}>
      <Sidebar profile={profile} coverageCount={coverageCount} incidentCount={incidentCount} />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
