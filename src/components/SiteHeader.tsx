import { Link, useRouteContext, useRouter } from "@tanstack/react-router";
import { Waves } from "lucide-react";
import { logout } from "@/lib/auth";

export function SiteHeader() {
  const { auth } = useRouteContext({ from: "__root__" });
  const router = useRouter();

  async function handleLogout() {
    await logout();
    await router.invalidate();
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: "var(--gradient-hero)" }}
            aria-hidden
          >
            <Waves className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="text-lg">QuietHours</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-foreground" }}
            className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
          <Link
            to="/map"
            activeProps={{ className: "text-foreground" }}
            className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
          >
            Map
          </Link>
          <Link
            to="/about"
            activeProps={{ className: "text-foreground" }}
            className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
          >
            About
          </Link>
          {auth ? (
            <>
              <Link
                to="/account"
                activeProps={{ className: "text-foreground" }}
                className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                Account
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                activeProps={{ className: "text-foreground" }}
                className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                Login
              </Link>
              <Link
                to="/signup"
                activeProps={{ className: "text-foreground" }}
                className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} QuietHours — Built for sensory-friendly cities.</p>
        <p>A hackathon project for accessibility & social good.</p>
      </div>
    </footer>
  );
}
