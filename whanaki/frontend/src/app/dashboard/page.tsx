import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare, FileText, BarChart2, ArrowRight, Shield } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();

  const cards = [
    { href: "/chat",      icon: MessageSquare, title: "Start a conversation",  desc: "Ask questions about your uploaded documents",   cta: "Open chat"      },
    { href: "/documents", icon: FileText,      title: "Manage documents",       desc: "Upload PDFs, Word docs, and text files",         cta: "View documents" },
    { href: "/usage",     icon: BarChart2,     title: "Check usage",            desc: "See your query count and monthly breakdown",     cta: "View usage"     },
  ];

  return (
    <div className="flex h-screen">
      {/* Minimal sidebar for dashboard only */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-6 h-6 bg-[#0f6e56] rounded-md flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Whānaki</span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {[
            { href: "/chat",      icon: MessageSquare, label: "Chat"      },
            { href: "/documents", icon: FileText,      label: "Documents" },
            { href: "/usage",     icon: BarChart2,     label: "Usage"     },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <Icon className="w-4 h-4 text-gray-400" />{label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50 p-10">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Kia ora, {user?.firstName ?? "there"} 👋
          </h1>
          <p className="text-gray-500 mb-8">Your workspace is ready.</p>

          <div className="grid gap-4">
            {cards.map(({ href, icon: Icon, title, desc, cta }) => (
              <Link key={href} href={href} className="group bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4 hover:border-[#9fe1cb] transition-colors">
                <div className="w-10 h-10 bg-[#e1f5ee] rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#0f6e56]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{title}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
                <span className="text-sm text-[#0f6e56] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {cta}<ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-8 bg-[#e1f5ee] border border-[#9fe1cb] rounded-xl p-4">
            <p className="text-sm text-[#0f6e56] font-medium mb-1 flex items-center gap-1.5">
              <Shield className="w-4 h-4" />NZ data sovereignty
            </p>
            <p className="text-sm text-[#0a5441]">
              All AI processing happens on DigitalOcean servers in Sydney. Your documents never leave the region.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
