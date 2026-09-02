"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "./InstructorShell.module.css";

const WHATSAPP_LINK = "https://chat.whatsapp.com/YOUR_COMMUNITY_LINK"; // TODO: Replace with actual link

const NAV_MENU = [
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
];

const NAV_RESOURCES = [
  {
    href: "/instructor/incident-report",
    label: "Incident Report",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    ),
  },
];

const NAV_PROFILE = [
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

// Mobile bottom tabs - without Profile (moved to topbar)
const NAV_ITEMS = [...NAV_MENU, ...NAV_RESOURCES];

export default function InstructorShell({ profile, coverageCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "I";
  const avatarUrl = profile?.avatar_url;

  const getBadgeCount = (item) => {
    if (item.badgeKey === "coverageCount") {
      return coverageCount;
    }
    return 0;
  };

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
          <span className={styles.navLabel} style={{ marginTop: 16 }}>Resources</span>
          {NAV_RESOURCES.map((item) => {
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
          <span className={styles.navLabel} style={{ marginTop: 16 }}>Account</span>
          {NAV_PROFILE.map((item) => {
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
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.headerIconBtn}
          aria-label="WhatsApp Community"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
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
