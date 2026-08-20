import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import LogoutButton from "./LogoutButton";

export const metadata = {
  title: "Instructor Dashboard | Shape Your Destiny",
  description: "Instructor dashboard for Shape Your Destiny wellness program.",
};

export default async function InstructorDashboardPage() {
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

  // Redirect admins to admin dashboard
  if (profile?.role === "admin") {
    redirect("/admin/dashboard");
  }

  return (
    <>
      <Header />

      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.iconBadge}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          <span className={styles.eyebrow}>Instructor Dashboard</span>
          <h1>Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}!</h1>

          <div className={styles.info}>
            <p><strong>Logged in as:</strong> {profile?.full_name || user.email}</p>
            <p><strong>Role:</strong> {profile?.role || "instructor"}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </div>

          <LogoutButton />
        </div>
      </section>

      <Footer />
    </>
  );
}
