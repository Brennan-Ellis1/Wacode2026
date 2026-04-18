import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MapPin, Ear, Eye, Users, Sparkles, ArrowRight } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { SEED_PLACES, fmtHour, loadToLevel, levelColorVar } from "@/lib/sensory";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuietHours — A sensory-friendly map of your city" },
      {
        name: "description",
        content:
          "The first map that knows when a place is quiet — not just where. For autistic, sensory-sensitive, and overstimulated humans.",
      },
      { property: "og:title", content: "QuietHours — A sensory-friendly map of your city" },
      {
        property: "og:description",
        content: "Find calm places, right now. Map the world by sensory load over time.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <FinalCTA />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  // Animated time-of-day demo
  const [hour, setHour] = useState(8);
  useEffect(() => {
    const id = setInterval(() => setHour((h) => (h + 1) % 24), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: "var(--gradient-hero)", filter: "blur(80px)" }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> For 1 in 5 people who experience the world louder
          </span>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Find <span style={{ color: "var(--calm-foreground)" }}>calm</span> places,{" "}
            <em className="not-italic" style={{ color: "var(--primary)" }}>
              right now.
            </em>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            QuietHours is the first map that knows <em>when</em> a place is quiet — not just{" "}
            <em>where</em>. Built for autistic, sensory-sensitive, and overstimulated humans.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/map"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-md transition-transform hover:scale-[1.02]"
            >
              Open the live map <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Why this matters
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl backdrop-blur" style={{ boxShadow: "var(--shadow-soft)" }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Same neighborhood, different hour
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums">
                {fmtHour(hour)}
              </span>
            </div>
            <MiniMap hour={hour} />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <Legend />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Legend() {
  const items: Array<{ key: "calm" | "moderate" | "busy" | "overwhelming"; label: string }> = [
    { key: "calm", label: "Calm" },
    { key: "moderate", label: "Moderate" },
    { key: "busy", label: "Busy" },
    { key: "overwhelming", label: "Overwhelming" },
  ];
  return (
    <>
      {items.map((i) => (
        <span key={i.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: levelColorVar(i.key) }} />
          {i.label}
        </span>
      ))}
    </>
  );
}

function MiniMap({ hour }: { hour: number }) {
  // Project seed places onto a 320x220 mini canvas
  const minLat = 40.726,
    maxLat = 40.735,
    minLng = -74.0,
    maxLng = -73.99;
  const W = 100,
    H = 70;
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        height: 240,
        background:
          "radial-gradient(ellipse at 30% 30%, oklch(0.93 0.04 150) 0%, oklch(0.95 0.02 95) 60%, oklch(0.94 0.02 80) 100%)",
      }}
      aria-hidden
    >
      {/* faint street lines */}
      <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 100 70" preserveAspectRatio="none">
        <path d="M0 18 L100 14" stroke="oklch(0.7 0.02 200)" strokeWidth="0.4" />
        <path d="M0 38 L100 42" stroke="oklch(0.7 0.02 200)" strokeWidth="0.4" />
        <path d="M0 58 L100 54" stroke="oklch(0.7 0.02 200)" strokeWidth="0.4" />
        <path d="M22 0 L26 70" stroke="oklch(0.7 0.02 200)" strokeWidth="0.4" />
        <path d="M58 0 L54 70" stroke="oklch(0.7 0.02 200)" strokeWidth="0.4" />
        <path d="M82 0 L84 70" stroke="oklch(0.7 0.02 200)" strokeWidth="0.4" />
      </svg>
      {SEED_PLACES.map((p) => {
        const x = ((p.lng - minLng) / (maxLng - minLng)) * W;
        const y = (1 - (p.lat - minLat) / (maxLat - minLat)) * H;
        const load = p.hourly[hour];
        const level = loadToLevel(load);
        return (
          <span
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pulse-soft"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: 14 + load / 8,
              height: 14 + load / 8,
              backgroundColor: levelColorVar(level),
              boxShadow: `0 0 0 4px ${`color-mix(in oklab, ${levelColorVar(level)} 25%, transparent)`}`,
            }}
          />
        );
      })}
    </div>
  );
}

function Problem() {
  return (
    <section className="border-y border-border/60 bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="text-3xl font-semibold tracking-tight">A world tuned too loud.</h2>
            <p className="mt-3 text-muted-foreground">
              Sensory accessibility is invisible on every map you've used.
            </p>
          </div>
          <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
            <Stat big="1 in 36" label="children identified as autistic in the U.S." />
            <Stat big="20%" label="of people experience sensory processing differences" />
            <Stat big="0" label="major mapping apps tell you when a place is calm" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="text-4xl font-semibold tracking-tight" style={{ color: "var(--primary)" }}>
        {big}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: MapPin,
      title: "Open the map",
      body: "See nearby places color-coded by how they feel right now — calm, moderate, busy, overwhelming.",
    },
    {
      icon: Clock,
      title: "Scrub through time",
      body: "Drag the time slider to see when each place is calmest. Find your window.",
    },
    {
      icon: Sparkles,
      title: "Share what you feel",
      body: "Drop a quick report so the next person knows. Crowd-sourced calm.",
    },
  ];
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
        <p className="mt-2 text-muted-foreground">Three steps. Built for everyone.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border/60 bg-card p-6">
              <div
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: "var(--gradient-hero)" }}
              >
                <s.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="text-xs font-medium text-muted-foreground">Step {i + 1}</div>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Ear, title: "Noise-aware", body: "Track ambient noise patterns hour by hour." },
    { icon: Eye, title: "Light-aware", body: "Bright fluorescents at noon, soft pendants by 6pm." },
    { icon: Users, title: "Crowd-aware", body: "Predict the rush before you walk into it." },
    { icon: Sparkles, title: "Smell-aware", body: "Salons, kitchens, cleaners — fragrance matters." },
  ];
  return (
    <section className="bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-semibold tracking-tight">Four senses, one map.</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Most "accessibility" apps reduce sensory experience to a single yes/no. Real life is more
          complicated than that.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 bg-card p-6">
              <f.icon className="h-6 w-6" style={{ color: "var(--primary)" }} />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24">
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{ background: "var(--gradient-hero)", filter: "blur(60px)" }}
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Step into a calmer city.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Open the live demo. Drag the time slider. Find your quiet hour.
        </p>
        <Link
          to="/map"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.02]"
        >
          Open the map <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
