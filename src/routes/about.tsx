import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — QuietHours" },
      {
        name: "description",
        content:
          "Why sensory accessibility is the missing layer of every map — and how QuietHours fills it.",
      },
      { property: "og:title", content: "About — QuietHours" },
      {
        property: "og:description",
        content: "Why sensory accessibility matters and how QuietHours measures it.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-semibold tracking-tight">Why we built QuietHours</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Mapping apps tell you where things are. They almost never tell you what those places{" "}
          <em>feel</em> like — and they certainly don't tell you when they feel different.
        </p>

        <Section title="The gap">
          <p>
            Roughly 1 in 36 children is identified as autistic, and an estimated 1 in 5 people
            experience some form of sensory processing difference — from misophonia to PTSD to
            chronic migraine. For all of them, an "accessible" café isn't accessible if it's
            blasting espresso machines and overhead pop music at 1pm.
          </p>
          <p>
            Existing accessibility maps focus on physical access: ramps, doorways, restrooms.
            That work matters. But sensory load — noise, light, crowd density, smell — is the
            invisible barrier nobody's mapping.
          </p>
        </Section>

        <Section title="The time dimension">
          <p>
            Most public spaces aren't loud all the time. A library is calm at 10am and chaotic at
            3:30pm when school lets out. A grocery store is overwhelming at 6pm and quiet at 8am.
            QuietHours is built around that simple insight: <strong>where</strong> is half the
            answer. <strong>When</strong> is the other half.
          </p>
        </Section>

        <Section title="How it works">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Crowd reports</strong> — quick four-slider check-ins from people on the
              ground (noise, light, crowd, smell).
            </li>
            <li>
              <strong>Time-bucketed averages</strong> — each place gets a 24-hour profile, not a
              single rating.
            </li>
            <li>
              <strong>Live overlay</strong> — color-coded pins update as the time slider moves.
            </li>
            <li>
              <strong>Sensory-friendly hours</strong> — businesses can publish their own quiet
              windows.
            </li>
          </ul>
        </Section>

        <Section title="Built accessible">
          <p>
            Because this is a tool for disabled people, the tool itself must be a model.
            QuietHours uses semantic HTML, full keyboard navigation, visible focus rings, ARIA
            live regions for map updates, and never communicates state with color alone — every
            sensory level has both a color and a label.
          </p>
        </Section>

        <div className="mt-12 rounded-2xl border border-border/60 bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Ready to try it? The live demo is seeded with realistic neighborhood data — drag the
            time slider and watch the map breathe.
          </p>
          <Link
            to="/map"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open the map →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
