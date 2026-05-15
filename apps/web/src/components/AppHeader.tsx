import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../hooks/useAuth";
import { useConfig } from "../hooks/useConfig";
import { Button } from "./ui/button";
import { HPMark } from "./HPMark";
import { SettingsMenu } from "./SettingsMenu";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/bills", label: "Bills", end: false },
];

function initialFromEmail(email: string | undefined): string {
  if (!email) return "?";
  return email.charAt(0).toUpperCase();
}

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useMe();
  const { data: config } = useConfig();
  const logout = useLogout();

  const demoMode = !!config?.demoSkipLogin || !!config?.demoAllowAllApprovals;
  const hideSignOut = !!config?.demoSkipLogin;

  function onLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-20 w-full",
        "border-b border-hp-border",
        "bg-background/60 backdrop-blur-xl",
      )}
    >
      <div className="flex items-center justify-between px-7 py-3.5">
        <div className="flex items-center gap-5">
          <Link
            to="/"
            aria-label="HarakaPay home"
            className="flex items-center gap-2.5 hover:opacity-90"
          >
            <HPMark size={26} radius={7} />
            <span className="text-[14px] font-semibold tracking-[-0.01em]">
              HarakaPay
            </span>
          </Link>

          <nav
            className={cn(
              "inline-flex items-center gap-0.5 rounded-[9px] p-[3px]",
              "bg-foreground/5",
            )}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={cn(
                    "rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors",
                    isActive
                      ? "bg-foreground/10 text-foreground"
                      : "text-hp-text-dim hover:text-foreground",
                  )}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3.5">
          {demoMode && (
            <span
              title={[
                config?.demoSkipLogin && "login disabled",
                config?.demoAllowAllApprovals && "any user can approve",
              ]
                .filter(Boolean)
                .join(" · ")}
              style={{
                color: "var(--hp-accent)",
                background:
                  "color-mix(in srgb, var(--hp-accent) 14%, transparent)",
              }}
              className="font-mono text-[10.5px] font-bold tracking-[0.6px] rounded-full px-2.5 py-0.5"
            >
              DEMO
            </span>
          )}

          <SettingsMenu />

          <div
            aria-hidden="true"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--hp-accent), color-mix(in srgb, var(--hp-accent) 50%, white))",
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-[#0c0c0e]"
          >
            {initialFromEmail(user?.email)}
          </div>

          {user?.email && (
            <span className="hidden text-[12px] text-hp-text-dim sm:inline">
              {user.email}
            </span>
          )}

          {!hideSignOut && user && (
            <Button
              variant="ghost"
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
