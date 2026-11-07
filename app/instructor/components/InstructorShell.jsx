"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "./InstructorShell.module.css";

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5" />
    <path d="M10 13h6M10 17h6" />
  </svg>
);

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
  </svg>
);

const NAV_MENU = [
  {
    href: "/instructor/dashboard",
    label: "Schedule",
    icon: <CalendarIcon />,
  },
  {
    href: "/instructor/inbox",
    label: "Inbox",
    icon: <InboxIcon />,
    hasBadge: true,
  },
];

const NAV_RESOURCES = [
  {
    href: "/instructor/forms",
    label: "Forms",
    icon: <DocumentIcon />,
  },
];

const NAV_PROFILE = [
  {
    href: "/instructor/profile",
    label: "Profile",
    icon: <ProfileIcon />,
  },
];

// Mobile bottom tabs - Schedule, Inbox, and Forms (Profile is in topbar)
const MOBILE_TABS = [
  {
    href: "/instructor/dashboard",
    label: "Schedule",
    icon: <CalendarIcon />,
    activeFor: ["/instructor/dashboard"],
  },
  {
    href: "/instructor/inbox",
    label: "Inbox",
    icon: <InboxIcon />,
    activeFor: ["/instructor/inbox"],
    hasBadge: true,
  },
  {
    href: "/instructor/forms",
    label: "Forms",
    icon: <DocumentIcon />,
    activeFor: ["/instructor/forms", "/instructor/incident-report"],
  },
];

export default function InstructorShell({ profile, inboxBadge = 0 }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "I";
  const avatarUrl = profile?.avatar_url;

  const renderAvatar = (size = 40, className = styles.avatar) => {
    if (avatarUrl) {
      return (
        <Image
          src={avatarUrl}
          alt={profile?.full_name || "Profile"}
          width={size}
          height={size}
          className={className}
          style={{ objectFit: "cover" }}
        />
      );
    }
    return <div className={className}>{initial}</div>;
  };

  const isTabActive = (item) => {
    if (item.activeFor) {
      return item.activeFor.some(
        (path) => pathname === path || pathname.startsWith(path + "/")
      );
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
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
          {NAV_MENU.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const badgeCount = item.hasBadge ? inboxBadge : 0;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
                {badgeCount > 0 && <span className={styles.badge}>{badgeCount}</span>}
              </a>
            );
          })}
          <span className={styles.navLabel} style={{ marginTop: 16 }}>Resources</span>
          {NAV_RESOURCES.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/") || pathname.startsWith("/instructor/incident-report");
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
          <span className={styles.navLabel} style={{ marginTop: 16 }}>Account</span>
          {NAV_PROFILE.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
          {renderAvatar(40, avatarUrl ? styles.avatarImg : styles.avatar)}
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
        <div className={styles.headerSpacer} />
        <Image
          src="/Images/footer_logo_gold.webp"
          alt="Shape Your Destiny"
          width={130}
          height={24}
          className={styles.mobileLogo}
          priority
        />
        <a href="/instructor/profile" className={styles.headerAvatar}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Profile"
              width={32}
              height={32}
              className={styles.headerAvatarImg}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <span className={styles.headerAvatarInitial}>{initial}</span>
          )}
        </a>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className={styles.bottomTabs} aria-label="Main">
        <div className={styles.bottomTabsInner}>
          {MOBILE_TABS.map((item) => {
            const isActive = isTabActive(item);
            const badgeCount = item.hasBadge ? inboxBadge : 0;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={styles.tabIconWrap}>
                  <span className={styles.tabIcon}>{item.icon}</span>
                  {badgeCount > 0 && <span className={styles.tabBadge}>{badgeCount}</span>}
                </span>
                <span className={styles.tabLabel}>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
}
