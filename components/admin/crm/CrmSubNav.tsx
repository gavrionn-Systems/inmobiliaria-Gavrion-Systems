"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { crmNav } from "@/lib/site";

export default function CrmSubNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = crmNav.filter(
    (item) => !("adminOnly" in item) || isAdmin
  );

  return (
    <nav
      aria-label="Secciones del CRM"
      className="mb-8 flex gap-1 overflow-x-auto custom-scrollbar border-b border-outline-variant"
    >
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap px-3 py-3 font-label-md text-label-md border-b-2 transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
