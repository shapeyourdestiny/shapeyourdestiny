import { createClient } from "@/lib/supabase/server";
import InviteCodeForm from "./InviteCodeForm";
import CreateAccountForm from "./CreateAccountForm";
import InviteActions from "./InviteActions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invite Codes | Admin | Shape Your Destiny",
};

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: inviteCodes } = await supabase
    .from("invite_codes")
    .select("id, code, role, used_by, sent_to, sent_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Invite Codes</h1>
        <p>Create and manage invite codes for new instructors and admins.</p>
      </div>

      <div className={styles.formsGrid}>
        <InviteCodeForm />
        <CreateAccountForm />
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2>All Invite Codes</h2>
          <span className={styles.tableSubhead}>Newest first</span>
        </div>
        {inviteCodes && inviteCodes.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Sent To</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.map((invite) => (
                  <tr key={invite.id}>
                    <td className={styles.code}>{invite.code}</td>
                    <td className={styles.email}>{invite.sent_to || "—"}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${invite.role === "admin" ? styles.roleAdmin : styles.roleInstructor}`}>
                        {invite.role}
                      </span>
                    </td>
                    <td>
                      {invite.used_by ? (
                        <span className={styles.statusUsed}>
                          <span className={styles.statusDot}></span>
                          Used
                        </span>
                      ) : (
                        <span className={styles.statusAvailable}>
                          <span className={styles.statusDot}></span>
                          Available
                        </span>
                      )}
                    </td>
                    <td className={styles.date}>
                      {invite.sent_at ? formatDate(invite.sent_at) : "—"}
                    </td>
                    <td className={styles.actions}>
                      {!invite.used_by && <InviteActions inviteId={invite.id} email={invite.sent_to} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>No invite codes yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
