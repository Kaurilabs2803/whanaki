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
  { href: "/chat",      icon: MessageSquare, label: "Chat"      },
  { href: "/documents", icon: FileText,      label: "Documents" },
  { href: "/usage",     icon: BarChart2,     label: "Usage"     },
  { href: "/billing",   icon: CreditCard,    label: "Billing"   },
  { href: "/settings",  icon: Settings,      label: "Settings"  },
];

interface SidebarProps {
  children: React.ReactNode;
}

export function AppShell({ children }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#0f6e56] rounded-md flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">Whānaki</span>
          </div>
          <p className="text-[10px] text-[#0f6e56] mt-0.5 pl-8">NZ data · NZ servers</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group",
                  active
                    ? "bg-[#e1f5ee] text-[#0a5441] font-medium"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#0f6e56]" : "text-gray-400 group-hover:text-gray-600")} />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-[#0f6e56]" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <UserButton afterSignOutUrl="/" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {user?.emailAddresses[0]?.emailAddress}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
