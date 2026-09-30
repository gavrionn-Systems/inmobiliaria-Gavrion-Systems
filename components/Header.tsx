"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { navItems, site } from "@/lib/site";

function splitBrandName(name: string) {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return { short: trimmed, rest: "" };
  }

  return {
    short: words.slice(0, 2).join(" "),
    rest: words.slice(2).join(" "),
  };
}

export default function Header({
  logoUrl = site.logoUrl,
  name = site.name,
}: {
  logoUrl?: string;
  name?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { short, rest } = splitBrandName(name);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (e.key !== "Tab") return;

      const panelLinks = panelRef.current
        ? Array.from(
            panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
          )
        : [];
      const cycle = [menuButtonRef.current, ...panelLinks].filter(
        (node): node is HTMLElement => Boolean(node),
      );
      if (cycle.length === 0) return;

      const currentIndex = cycle.indexOf(document.activeElement as HTMLElement);
      const lastIndex = cycle.length - 1;
      if (e.shiftKey) {
        if (currentIndex <= 0) {
          e.preventDefault();
          cycle[lastIndex].focus();
        }
      } else if (currentIndex === lastIndex) {
        e.preventDefault();
        cycle[0].focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="bg-surface border-b border-outline-variant fixed top-0 w-full z-sticky pt-[env(safe-area-inset-top,0px)]">
      <div className="flex justify-between items-center max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop h-20">
        <Link
          href="/"
          aria-label={name}
          className="flex items-center gap-2.5 min-w-0 sm:gap-3"
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
          <span
            aria-hidden="true"
            className="font-headline-md font-bold text-on-surface text-base sm:text-lg lg:text-headline-md leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {short}
            {rest ? <span className="hidden lg:inline"> {rest}</span> : null}
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8" aria-label="Principal">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`font-label-md text-label-md pb-1 border-b-2 transition-colors duration-200 ${
                isActive(item.href)
                  ? "text-primary font-bold border-primary"
                  : "text-secondary font-medium border-transparent hover:text-primary"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          ref={menuButtonRef}
          type="button"
          className="lg:hidden text-on-surface w-11 h-11 flex items-center justify-center"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((current) => !current)}
        >
          <span aria-hidden="true" className="material-symbols-outlined">
            {open ? "close" : "menu"}
          </span>
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="lg:hidden fixed inset-x-0 bottom-0 z-overlay bg-on-surface/40"
            style={{ top: "var(--header-offset)" }}
            aria-label="Cerrar menú"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <nav
            ref={panelRef}
            id={menuId}
            aria-label="Principal"
            className="lg:hidden fixed inset-x-0 z-modal bg-surface overflow-y-auto px-margin-mobile pt-2 flex flex-col border-b border-outline-variant"
            style={{
              top: "var(--header-offset)",
              maxHeight: "calc(100dvh - var(--header-offset))",
              paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
            }}
          >
            {navItems.map((item, index) => (
              <Link
                key={item.key}
                ref={index === 0 ? firstLinkRef : undefined}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`font-label-md text-label-md min-h-11 flex items-center border-b border-outline-variant/50 ${
                  isActive(item.href)
                    ? "text-primary font-bold"
                    : "text-secondary"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      ) : null}
    </header>
  );
}
