import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Shield, Zap, BookOpen, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <span className="text-xl font-semibold text-gray-900">Whānaki</span>
        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-sm text-gray-600 hover:text-gray-900">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="text-sm bg-[#0f6e56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5441] transition">
                Get started free
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="text-sm bg-[#0f6e56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5441] transition"
            >
              Go to dashboard
            </Link>
          </SignedIn>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#e1f5ee] text-[#0f6e56] text-sm font-medium px-3 py-1 rounded-full mb-6">
          <Shield className="w-3.5 h-3.5" />
          Your data never leaves New Zealand
        </div>

        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          AI that actually knows{" "}
          <span className="text-[#0f6e56]">New Zealand</span>
        </h1>

        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Tenancy law. Tax codes. Building regs. IRD rulings. Upload your NZ documents and get
          accurate, cited answers — powered by AI running entirely on NZ servers.
        </p>

        <div className="flex items-center justify-center gap-4">
          <SignUpButton mode="modal">
            <button className="flex items-center gap-2 bg-[#0f6e56] text-white px-6 py-3 rounded-xl text-base font-medium hover:bg-[#0a5441] transition">
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </button>
          </SignUpButton>
          <Link
            href="#how-it-works"
            className="text-gray-600 hover:text-gray-900 text-base"
          >
            How it works
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Shield,
              title: "Fully sovereign",
              body: "All models run on DigitalOcean's Sydney region. No query ever touches OpenAI, Google, or overseas servers.",
            },
            {
              icon: BookOpen,
              title: "Cites its sources",
              body: "Every answer references the exact section of the document it came from. No hallucinated law.",
            },
            {
              icon: Zap,
              title: "Three models, one click",
              body: "Fast answers in seconds, or deep legal analysis. Choose the right model for the task.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="p-6 rounded-2xl border border-gray-100 hover:border-[#9fe1cb] transition">
              <div className="w-10 h-10 bg-[#e1f5ee] rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#0f6e56]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple NZD pricing</h2>
          <p className="text-gray-500 mb-12">14-day free trial. No credit card required.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Starter", price: "$99", queries: "200 queries/mo", pages: "500 pages" },
              { name: "Professional", price: "$299", queries: "1,000 queries/mo", pages: "2,000 pages", featured: true },
              { name: "Enterprise", price: "$799", queries: "Unlimited queries", pages: "Unlimited pages" },
            ].map(({ name, price, queries, pages, featured }) => (
              <div
                key={name}
                className={`p-6 rounded-2xl text-left ${
                  featured
                    ? "bg-[#0f6e56] text-white"
                    : "bg-white border border-gray-200"
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${featured ? "text-[#9fe1cb]" : "text-[#0f6e56]"}`}>
                  {name}
                </div>
                <div className={`text-3xl font-bold mb-1 ${featured ? "text-white" : "text-gray-900"}`}>
                  {price}
                  <span className={`text-base font-normal ${featured ? "text-[#9fe1cb]" : "text-gray-400"}`}>/mo NZD</span>
                </div>
                <div className={`text-sm mb-1 ${featured ? "text-[#9fe1cb]" : "text-gray-500"}`}>{queries}</div>
                <div className={`text-sm ${featured ? "text-[#9fe1cb]" : "text-gray-500"}`}>{pages}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Kauri Labs Limited · Upper Hutt, New Zealand
      </footer>
    </main>
  );
}
