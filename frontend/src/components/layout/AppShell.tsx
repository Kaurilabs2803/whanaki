"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import {
  MessageSquare, FileText, BarChart2, CreditCard,
  Settings, Shield, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/usage", icon: BarChart2, label: "Usage" },
  { href: "/billing", icon: CreditCard, label: "Billing" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  children: React.ReactNode;
}

export function AppShell({ children }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <aside className="grain-bg surface-panel relative flex w-72 shrink-0 flex-col overflow-hidden border-r border-[var(--sidebar-border)]">
        <div className="hero-orb left-[-3rem] top-[-3rem] h-32 w-32 bg-[rgba(76,175,80,0.18)]" />
        <div className="hero-orb bottom-[10%] right-[-2rem] h-24 w-24 bg-[rgba(62,39,35,0.1)]" />

        <div className="relative border-b border-[var(--sidebar-border)] px-6 py-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] shadow-soft">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-serif text-xl font-bold text-[var(--sidebar-foreground)]">Whanaki</p>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                Sovereign Knowledge
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-[rgba(46,125,50,0.16)] bg-[rgba(255,255,255,0.45)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Operating model</p>
            <p className="mt-1 text-sm font-medium text-[var(--sidebar-foreground)]">
              Cited answers, document grounded retrieval, regional data custody.
            </p>
          </div>
        </div>

        <nav className="relative flex-1 space-y-1 overflow-y-auto px-4 py-5">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-all",
                  active
                    ? "border-[rgba(46,125,50,0.2)] bg-[rgba(200,230,201,0.72)] text-[var(--accent-foreground)] shadow-soft"
                    : "border-transparent text-[var(--muted-foreground)] hover:border-[rgba(46,125,50,0.12)] hover:bg-[rgba(255,255,255,0.45)] hover:text-[var(--sidebar-foreground)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                    active
                      ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
                      : "bg-[rgba(255,255,255,0.5)] text-[var(--muted-foreground)] group-hover:text-[var(--accent-foreground)]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{label}</span>
                {active && <ChevronRight className="ml-auto h-4 w-4 text-[var(--accent-foreground)]" />}
              </Link>
            );
          })}
        </nav>

        <div className="relative border-t border-[var(--sidebar-border)] px-4 py-4">
          <div className="rounded-2xl border border-[rgba(46,125,50,0.12)] bg-[rgba(255,255,255,0.5)] p-4">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--sidebar-foreground)]">
                  {user?.fullName ?? user?.firstName ?? "Workspace user"}
                </p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {user?.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
