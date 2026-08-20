"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  {
    href: "/admin/dashboard",
    label: "Invite Codes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    href: "/admin/instructors",
    label: "Instructors",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

export default function Sidebar({ profile }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "A";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Image
          src="/Images/footer_logo_gold.png"
          alt="Shape Your Destiny"
          width={120}
          height={28}
          className={styles.logo}
          priority
        />
      </div>

      <nav className={styles.nav}>
        <span className={styles.navLabel}>Overview</span>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className={styles.user}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{profile?.full_name || "Admin"}</span>
          <span className={styles.userRole}>Admin</span>
        </div>
        <button onClick={handleLogout} className={styles.logout}>
          Log Out
        </button>
      </div>
    </aside>
  );
}
