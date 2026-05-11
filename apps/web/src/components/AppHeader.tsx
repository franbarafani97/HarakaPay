import { Link, useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../hooks/useAuth";
import { useConfig } from "../hooks/useConfig";
import { Button } from "./ui/button";
import logoUrl from "../assets/harakapay-icon.jpg";

export default function AppHeader() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const { data: config } = useConfig();
  const logout = useLogout();

  const demoMode = !!config?.demoSkipLogin || !!config?.demoAllowAllApprovals;
  const hideSignOut = !!config?.demoSkipLogin;

  function onLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center hover:opacity-80"
            aria-label="HarakaPay home"
          >
            <img src={logoUrl} alt="HarakaPay" className="h-9 w-9 rounded-md" />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/bills"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Bills
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {demoMode && (
            <span
              className="text-xs font-medium tracking-wide uppercase rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 px-2.5 py-0.5"
              title={[
                config?.demoSkipLogin && "login disabled",
                config?.demoAllowAllApprovals && "any user can approve",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              Demo mode
            </span>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user?.email}
          </span>
          {!hideSignOut && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onLogout}
              disabled={logout.isPending}
            >
              {logout.isPending ? "Signing out…" : "Sign out"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
