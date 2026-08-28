"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "./Sidebar.module.css";

const NAV_OVERVIEW = [
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

const NAV_OPERATIONS = [
  {
    href: "/admin/schedule",
    label: "Schedule Board",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/admin/coverage",
    label: "Coverage",
    badgeKey: "coverageCount",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
];

export default function Sidebar({ profile, coverageCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "A";

  const getBadgeCount = (item) => {
    if (item.badgeKey === "coverageCount") {
      return coverageCount;
    }
    return 0;
  };

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
        {NAV_OVERVIEW.map((item) => {
          const isActive = pathname === item.href;
          const badgeCount = getBadgeCount(item);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {badgeCount > 0 && (
                <span className={styles.badge}>{badgeCount}</span>
              )}
            </a>
          );
        })}
        <span className={styles.navLabel} style={{ marginTop: 16 }}>Operations</span>
        {NAV_OPERATIONS.map((item) => {
          const isActive = pathname === item.href;
          const badgeCount = getBadgeCount(item);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {badgeCount > 0 && (
                <span className={styles.badge}>{badgeCount}</span>
              )}
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
