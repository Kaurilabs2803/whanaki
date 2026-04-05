"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs"
import Link from "next/link"
import { Shield, ArrowRight } from "lucide-react"

export default function Hero() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <svg className="absolute inset-0 w-0 h-0">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <linearGradient id="hero-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#06b6d4" />
            <stop offset="70%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <filter id="text-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <MeshGradient
        className="absolute inset-0 w-full h-full"
        colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
        speed={0.3}
        backgroundColor="#000000"
      />
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-60"
        colors={["#000000", "#ffffff", "#06b6d4", "#f97316"]}
        speed={0.2}
        wireframe="true"
        backgroundColor="transparent"
      />

      <div className="relative z-20 flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-cyan-400 backdrop-blur-sm ring-1 ring-white/10 transition group-hover:bg-white/15">
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold text-white tracking-tight">Whanaki</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {["Features", "Pricing", "Docs"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm text-white/70 hover:text-white px-4 py-2 rounded-full hover:bg-white/5 transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90">
                  Start workspace
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Open dashboard
              </Link>
            </SignedIn>
          </div>
        </header>

        <main className="flex-1 flex items-center px-6 lg:px-10 pb-16">
          <div className="max-w-2xl">
            <motion.div
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm mb-5 relative border border-white/10"
              style={{ filter: "url(#glass-effect)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="absolute top-0 left-1 right-1 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent rounded-full" />
              <span className="text-white/90 text-xs md:text-sm font-medium relative z-10 tracking-wide">
                Whanaki Knowledge Workspace
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 leading-[1.1] tracking-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <motion.span
                className="block font-light text-white/90 text-xl md:text-2xl lg:text-3xl mb-2 tracking-wider"
                style={{
                  background: "linear-gradient(135deg, #ffffff 0%, #06b6d4 30%, #f97316 70%, #ffffff 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "url(#text-glow)",
                  backgroundSize: "200% 200%",
                }}
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{
                  duration: 8,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
              >
                Sovereign & Local
              </motion.span>
              <span className="block font-semibold text-white">A knowledge workspace</span>
              <span className="block font-light text-white/70">that feels sovereign</span>
            </motion.h1>

            <motion.p
              className="text-base md:text-lg font-light text-white/60 mb-8 leading-relaxed max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              Turn your documents into a calm, credible research surface with cited answers,
              stronger retrieval, and a visual language that feels editorial instead of synthetic.
            </motion.p>

            <motion.div
              className="flex items-center gap-4 flex-wrap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
            >
              <SignedOut>
                <SignUpButton mode="modal">
                  <motion.button
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-orange-500 text-white font-semibold text-sm px-6 py-3 transition-all hover:from-cyan-400 hover:to-orange-400 shadow-lg hover:shadow-cyan-500/20"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard">
                  <motion.button
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-orange-500 text-white font-semibold text-sm px-6 py-3 transition-all hover:from-cyan-400 hover:to-orange-400 shadow-lg hover:shadow-cyan-500/20"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </Link>
              </SignedIn>
              <Link
                href="#capabilities"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 hover:border-cyan-400/50 hover:text-cyan-100 backdrop-blur-sm"
              >
                Explore capabilities
              </Link>
            </motion.div>
          </div>
        </main>

        <div className="absolute bottom-8 right-8 z-30 hidden lg:block">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <motion.svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              animate={{ rotate: 360 }}
              transition={{
                duration: 20,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
              style={{ transform: "scale(1.6)" }}
            >
              <defs>
                <path id="circle" d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
              </defs>
              <text className="text-[10px] fill-white/80 font-medium">
                <textPath href="#circle" startOffset="0%">
                  Whanaki • Knowledge Workspace • Built for NZ •
                </textPath>
              </text>
            </motion.svg>
          </div>
        </div>
      </div>
    </div>
  )
}
