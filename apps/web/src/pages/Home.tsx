import { useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../hooks/useAuth";

export default function Home() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();

  function onLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
      <p className="text-lg text-muted-foreground">
        Signed in as{" "}
        <span className="text-foreground font-medium">{user?.email}</span>
      </p>
      <button
        onClick={onLogout}
        disabled={logout.isPending}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {logout.isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
