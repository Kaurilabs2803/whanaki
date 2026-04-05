import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Shield, BookOpen, ArrowRight, Landmark, ScrollText } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="hero-orb left-[6%] top-[7%] h-48 w-48 bg-[rgba(76,175,80,0.14)]" />
      <div className="hero-orb right-[8%] top-[20%] h-56 w-56 bg-[rgba(224,214,201,0.9)]" />

      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-soft">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="font-serif text-xl font-bold">Whanaki</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Knowledge Workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[rgba(255,255,255,0.5)] hover:text-[var(--foreground)]">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-soft transition hover:brightness-95">
                Start workspace
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-soft transition hover:brightness-95"
            >
              Open dashboard
            </Link>
          </SignedIn>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl gap-10 px-6 pb-20 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:pb-28 lg:pt-14">
        <div className="section-fade">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(46,125,50,0.14)] bg-[rgba(255,255,255,0.48)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] shadow-soft">
            <Shield className="h-4 w-4" />
            Regional processing and document grounded answers
          </div>

          <h1 className="mt-6 max-w-4xl text-4xl font-bold leading-[1.05] lg:text-5xl">
            A knowledge workspace that feels built for New Zealand practice.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
            Whanaki turns your documents into a calm, credible research surface with cited answers,
            stronger retrieval, and a visual language that feels editorial instead of synthetic.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <SignUpButton mode="modal">
              <button className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-soft transition hover:brightness-95">
                Create workspace
                <ArrowRight className="h-4 w-4" />
              </button>
            </SignUpButton>
            <Link
              href="#capabilities"
              className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.52)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--secondary)]"
            >
              Explore capabilities
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Sovereign posture", "Built for teams that care where their documents live and how answers are formed."],
              ["Cited reasoning", "Responses reference source material so review feels grounded, not speculative."],
              ["Editorial UI", "Warm materials, sharper typography, and less of the commodity app feeling."],
            ].map(([title, body]) => (
              <div key={title} className="surface-card rounded-[1.5rem] p-5">
                <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="section-fade relative">
          <div className="surface-card grain-bg relative overflow-hidden rounded-[2rem] p-6 lg:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Research board</p>
                <h2 className="mt-2 text-xl font-bold">Citations stay in view</h2>
              </div>
              <div className="rounded-full bg-[rgba(46,125,50,0.12)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                Live workspace
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] border border-[rgba(46,125,50,0.12)] bg-[rgba(255,255,255,0.68)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Prompt</p>
                <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
                  Summarise the obligations in this lease review pack and point to the clauses that
                  create landlord exposure.
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[var(--sidebar)] p-5">
                <div className="mb-3 flex items-center gap-2 text-[var(--primary)]">
                  <ScrollText className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">Response stream</span>
                </div>
                <p className="text-sm leading-7 text-[var(--foreground)]">
                  The rent review mechanism is tied to CPI movement, but the notice provision appears
                  asymmetric in favour of the landlord. The cap is described in Schedule 2 and the
                  dispute route is set out in clause 18.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] border border-[rgba(46,125,50,0.14)] bg-[rgba(200,230,201,0.55)] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[var(--accent-foreground)]">Source one</p>
                  <p className="mt-2 text-sm font-semibold">Lease Review Pack.pdf</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Clause 18, page 14</p>
                </div>
                <div className="rounded-[1.35rem] border border-[rgba(109,76,65,0.12)] bg-[rgba(240,233,224,0.9)] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Model posture</p>
                  <p className="mt-2 text-sm font-semibold">Balanced retrieval</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Context first, no speculative filler.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Landmark,
              title: "Sovereign by posture",
              body: "The product language, data story, and system surface all support trust instead of leaning on generic AI tropes.",
            },
            {
              icon: BookOpen,
              title: "Reading room feel",
              body: "Serif headings, grounded neutrals, and editorial contrast give the product weight without hurting usability.",
            },
            {
              icon: Shield,
              title: "Core flows preserved",
              body: "Documents, chat, billing, and settings keep the same underlying behavior while the interface feels more considered.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="surface-card rounded-[1.75rem] p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] bg-[rgba(200,230,201,0.6)] text-[var(--primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
