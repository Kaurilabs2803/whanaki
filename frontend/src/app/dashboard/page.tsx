import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare, FileText, BarChart2, ArrowRight, Shield, Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();

  const cards = [
    { href: "/chat", icon: MessageSquare, title: "Open a conversation", desc: "Ask grounded questions across your uploaded materials.", cta: "Enter chat" },
    { href: "/documents", icon: FileText, title: "Shape your corpus", desc: "Upload and manage the documents that power retrieval.", cta: "View documents" },
    { href: "/usage", icon: BarChart2, title: "Track activity", desc: "See how the workspace is being used this billing period.", cta: "See usage" },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <aside className="surface-panel flex w-72 shrink-0 flex-col border-r border-[var(--sidebar-border)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-soft">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="font-serif text-2xl font-bold text-[var(--foreground)]">Whanaki</p>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Workspace home</p>
          </div>
        </div>

        <div className="surface-card mt-8 rounded-[1.75rem] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">System posture</p>
          <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
            Your workspace is ready for document ingestion, cited answers, and team based review.
          </p>
        </div>

        <div className="mt-auto rounded-[1.75rem] bg-[rgba(200,230,201,0.55)] p-5">
          <div className="flex items-center gap-2 text-[var(--accent-foreground)]">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em]">Ready state</p>
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
            Start with documents if you want stronger citations on the first conversation.
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-10 lg:px-12">
        <section className="surface-panel rounded-[2rem] p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Dashboard</p>
          <h1 className="mt-3 text-5xl font-bold text-[var(--foreground)]">
            Kia ora, {user?.firstName ?? "there"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--muted-foreground)]">
            The workspace is live. Move into chat, shape the underlying document set, or review usage before inviting the rest of your team.
          </p>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {cards.map(({ href, icon: Icon, title, desc, cta }) => (
            <Link key={href} href={href} className="surface-card group rounded-[1.85rem] p-6 transition-all hover:-translate-y-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] bg-[rgba(200,230,201,0.62)] text-[var(--primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{desc}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                {cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-card rounded-[1.85rem] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Workspace mood</p>
            <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
              Built to feel more like a research room than a generic assistant shell.
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
              This pass keeps the functional architecture intact while giving the interface stronger materials,
              typography, and hierarchy.
            </p>
          </div>

          <div className="rounded-[1.85rem] bg-[var(--primary)] p-6 text-[var(--primary-foreground)] shadow-soft">
            <p className="text-xs uppercase tracking-[0.24em] text-[rgba(255,255,255,0.72)]">Data posture</p>
            <p className="mt-3 text-2xl font-bold">Regional custody remains central.</p>
            <p className="mt-3 text-sm leading-7 text-[rgba(255,255,255,0.82)]">
              Documents, retrieval, and model output all stay framed as a controlled workspace flow rather than an open ended AI novelty.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
