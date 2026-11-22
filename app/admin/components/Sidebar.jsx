"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "./Sidebar.module.css";

// All navigation items in one list
const NAV_ITEMS = [
  {
    href: "/admin/inbox",
    label: "Inbox",
    shortLabel: "Inbox",
    badgeKey: "inboxCount",
    showInTabs: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
      </svg>
    ),
  },
  {
    href: "/admin/updates",
    label: "Updates",
    shortLabel: "Updates",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard",
    label: "Invite Codes",
    shortLabel: "Invites",
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
    shortLabel: "Instructors",
    showInTabs: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/admin/applications",
    label: "Applications",
    shortLabel: "Apps",
    badgeKey: "applicationsCount",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "/admin/programs",
    label: "Programs",
    shortLabel: "Programs",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V8l7-5 7 5v13" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    href: "/admin/schedule",
    label: "Schedule",
    shortLabel: "Schedule",
    showInTabs: true,
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
    href: "/admin/payroll",
    label: "Payroll",
    shortLabel: "Payroll",
    badgeKey: "payrollCount",
    showInTabs: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    href: "/admin/incident-reports",
    label: "Incidents",
    shortLabel: "Incidents",
    badgeKey: "incidentCount",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    ),
  },
  {
    href: "/admin/resources",
    label: "Resources",
    shortLabel: "Resources",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
        <path d="M20 4h-6a3 3 0 0 0-3 3M20 4v14h-6" />
      </svg>
    ),
  },
  {
    href: "/admin/surveys",
    label: "Surveys",
    shortLabel: "Surveys",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
];

// Get page title from pathname
function getPageTitle(pathname) {
  const item = NAV_ITEMS.find((i) => pathname.startsWith(i.href));
  return item?.label || "Admin";
}

export default function Sidebar({ profile, incidentCount = 0, inboxCount = 0, payrollCount = 0, applicationsCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "A";

  const getBadgeCount = (item) => {
    if (item.badgeKey === "incidentCount") return incidentCount;
    if (item.badgeKey === "inboxCount") return inboxCount;
    if (item.badgeKey === "payrollCount") return payrollCount;
    if (item.badgeKey === "applicationsCount") return applicationsCount;
    return 0;
  };

  // Close avatar menu on click outside
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClick = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [avatarMenuOpen]);

  // Close more menu on escape
  useEffect(() => {
    if (!moreOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [moreOpen]);

  // Lock body scroll when more menu is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  // Items for bottom tabs (5: Inbox, Schedule, Instructors, Payroll, More)
  const tabItems = NAV_ITEMS.filter((i) => i.showInTabs);

  // Check if current path matches a tab (or is in More menu)
  const isInMoreMenu = !tabItems.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Image
            src="/Images/footer_logo_gold.webp"
            alt="Shape Your Destiny"
            width={120}
            height={28}
            className={styles.logo}
            priority
          />
        </div>

        <nav className={styles.nav}>
          <span className={styles.navLabel}>Overview</span>
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin/inbox" && pathname.startsWith(item.href));
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
          {NAV_ITEMS.slice(5).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href);
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

      {/* Mobile Top Bar */}
      <header className={styles.mobileTopBar}>
        <Image
          src="/Images/footer_logo_gold.webp"
          alt="SYD"
          width={32}
          height={32}
          className={styles.mobileTopLogo}
          priority
        />
        <h1 className={styles.mobileTopTitle}>{getPageTitle(pathname)}</h1>
        <div className={styles.mobileAvatarWrapper} ref={avatarMenuRef}>
          <button
            className={styles.mobileAvatar}
            onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
            aria-label="Account menu"
          >
            {initial}
          </button>
          {avatarMenuOpen && (
            <div className={styles.avatarMenu}>
              <div className={styles.avatarMenuHeader}>
                <span className={styles.avatarMenuName}>{profile?.full_name || "Admin"}</span>
                <span className={styles.avatarMenuRole}>Admin</span>
              </div>
              <button onClick={handleLogout} className={styles.avatarMenuItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className={styles.mobileTabBar}>
        {tabItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href);
          const badgeCount = getBadgeCount(item);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`${styles.mobileTab} ${isActive ? styles.mobileTabActive : ""}`}
            >
              <span className={styles.mobileTabIcon}>{item.icon}</span>
              <span className={styles.mobileTabLabel}>{item.shortLabel}</span>
              {badgeCount > 0 && (
                <span className={styles.mobileTabBadge}>{badgeCount}</span>
              )}
            </a>
          );
        })}
        <button
          className={`${styles.mobileTab} ${isInMoreMenu || moreOpen ? styles.mobileTabActive : ""}`}
          onClick={() => setMoreOpen(true)}
        >
          <span className={styles.mobileTabIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </span>
          <span className={styles.mobileTabLabel}>More</span>
        </button>
      </nav>

      {/* More Menu (Full Screen) */}
      {moreOpen && (
        <div className={styles.moreOverlay}>
          <div className={styles.moreMenu}>
            <div className={styles.moreHeader}>
              <h2 className={styles.moreTitle}>Menu</h2>
              <button
                className={styles.moreClose}
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.moreGrid}>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                const badgeCount = getBadgeCount(item);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`${styles.moreTile} ${isActive ? styles.moreTileActive : ""}`}
                    onClick={() => setMoreOpen(false)}
                  >
                    <span className={styles.moreTileIcon}>{item.icon}</span>
                    <span className={styles.moreTileLabel}>{item.label}</span>
                    {badgeCount > 0 && (
                      <span className={styles.moreTileBadge}>{badgeCount}</span>
                    )}
                  </a>
                );
              })}
            </div>

            <button onClick={handleLogout} className={styles.moreLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
