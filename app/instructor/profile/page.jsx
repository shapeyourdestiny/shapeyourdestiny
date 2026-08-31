import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";
import LogoutButton from "./LogoutButton";

export const metadata = {
  title: "Profile | Shape Your Destiny",
  description: "Manage your instructor profile.",
};

export default async function InstructorProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "I";

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Profile</h1>

      <div className={styles.card}>
        <div className={styles.avatar}>{initial}</div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.label}>Name</span>
            <span className={styles.value}>{profile?.full_name || "—"}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Email</span>
            <span className={styles.value}>{user?.email || "—"}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Role</span>
            <span className={styles.roleBadge}>{profile?.role || "instructor"}</span>
          </div>
        </div>

        <LogoutButton />
      </div>
    </div>
  );
}
