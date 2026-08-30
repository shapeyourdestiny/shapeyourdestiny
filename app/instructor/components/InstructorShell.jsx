"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "./InstructorShell.module.css";

const NAV_ITEMS = [
  {
    href: "/instructor/dashboard",
    label: "Schedule",
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
    href: "/instructor/coverage",
    label: "Coverage",
    badgeKey: "coverageCount",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/instructor/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function InstructorShell({ profile, coverageCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "I";

  const getBadgeCount = (item) => {
    if (item.badgeKey === "coverageCount") {
      return coverageCount;
    }
    return 0;
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Image
            src="/Images/footer_logo_gold.webp"
            alt="Shape Your Destiny"
            width={140}
            height={26}
            className={styles.brandLogo}
          />
        </div>

        <nav className={styles.nav}>
          <span className={styles.navLabel}>Menu</span>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
            <span className={styles.userName}>{profile?.full_name || "Instructor"}</span>
            <span className={styles.userRole}>Instructor</span>
          </div>
          <button onClick={handleLogout} className={styles.logout}>
            Log Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className={styles.mobileHeader}>
        <Image
          src="/Images/footer_logo_gold.webp"
          alt="Shape Your Destiny"
          width={160}
          height={30}
          className={styles.mobileLogo}
          priority
        />
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className={styles.bottomTabs}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const badgeCount = getBadgeCount(item);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            >
              <span className={styles.tabIcon}>
                {item.icon}
                {badgeCount > 0 && (
                  <span className={styles.tabBadge}>{badgeCount}</span>
                )}
              </span>
              <span className={styles.tabLabel}>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </>
  );
}
