import { createFileRoute, redirect } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { loadPreferenceForCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context }) => {
    if (!context.auth) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async () => {
    return loadPreferenceForCurrentUser();
  },
  head: () => ({
    meta: [{ title: "Account — QuietHours" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { auth } = Route.useRouteContext();
  const pref = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="mt-2 text-muted-foreground">Manage your QuietHours profile and map defaults.</p>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{auth?.email}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Saved map preferences</h2>
          {pref ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Tolerance</dt>
                <dd className="font-medium capitalize">{pref.tolerance}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{pref.category}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No saved preferences yet. Visit the map and change tolerance/category to save them.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
