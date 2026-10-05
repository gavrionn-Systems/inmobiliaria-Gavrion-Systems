"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminLogoutButton from "@/components/AdminLogoutButton";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon?: string;
};

function isActive(pathname: string, item: NavItem) {
  const secretRouteSuffix = item.href.replace(/^\/admin/, "") || "/";
  return item.key === "dashboard"
    ? pathname === "/admin" || pathname.endsWith("/admin")
    : pathname === item.href ||
        pathname.startsWith(`${item.href}/`) ||
        pathname.endsWith(secretRouteSuffix);
}

export default function AdminSidebar({
  items,
  title,
  panelLabel,
  menuLabel,
  logoUrl,
  siteName,
  userName,
  roleLabel,
  loginPath,
  panelPath,
}: {
  items: readonly NavItem[];
  title: string;
  panelLabel: string;
  menuLabel: string;
  logoUrl: string;
  siteName: string;
  userName?: string;
  roleLabel?: string;
  loginPath: string;
  panelPath: string;
}) {
  const pathname = usePathname();
  const visibleHref = (href: string) => `${panelPath}${href.replace(/^\/admin/, "")}`;

  return (
    <aside className="w-72 bg-secondary hidden md:flex flex-col sticky top-0 h-screen border-r border-white/10">
      <Link
        href={panelPath}
        aria-label={siteName}
        className="flex items-center gap-3 px-5 py-6 border-b border-white/10 hover:bg-white/5 transition-colors"
      >
        <span className="brand-logo-mark" aria-hidden="true">
          <span className="brand-logo-disc">
            <Image
              src={logoUrl}
              alt=""
              width={40}
              height={40}
              priority
              className="h-full w-full object-contain"
            />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block font-headline-md text-headline-md text-surface text-lg leading-tight">
            {title}
          </span>
          <span className="mt-1 block font-label-sm text-label-sm text-surface-variant truncate">
            {panelLabel}
          </span>
        </span>
      </Link>

      {userName ? (
        <div className="mx-4 mt-5 rounded-xl border border-white/10 bg-white/5 px-3 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary-container text-xl">
              person
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-label-md text-label-md text-surface font-bold truncate">
              {userName}
            </p>
            {roleLabel ? (
              <p className="font-label-sm text-label-sm text-surface-variant truncate">
                {roleLabel}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="flex flex-col py-5 flex-1" aria-label="Administración">
        <div className="px-6 pb-3 flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-primary-fixed text-lg">
            dashboard
          </span>
          <p className="font-label-sm text-label-sm text-surface-variant uppercase tracking-[0.16em]">
            {menuLabel}
          </p>
        </div>

        <div className="flex flex-col gap-1 px-3">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.key}
                href={visibleHref(item.href)}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 font-label-md text-label-md transition-colors ${
                  active
                    ? "bg-primary-container text-on-primary-container shadow-sm"
                    : "text-surface-variant hover:bg-white/10 hover:text-surface"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`material-symbols-outlined text-xl ${
                    active ? "text-on-primary-container" : "text-primary-fixed"
                  }`}
                >
                  {item.icon ?? "arrow_forward"}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto border-t border-white/10 pt-4 px-3 flex flex-col gap-1">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl px-3 py-3 font-label-md text-label-md text-surface-variant hover:bg-white/10 hover:text-surface transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl text-primary-fixed">
              open_in_new
            </span>
            <span>Ver sitio público</span>
          </Link>
          <AdminLogoutButton loginPath={loginPath} />
        </div>
      </nav>
    </aside>
  );
}
