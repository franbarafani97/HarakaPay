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
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <p className="text-lg">Signed in as {user?.email}</p>
      <button
        onClick={onLogout}
        disabled={logout.isPending}
        className="border rounded px-4 py-2 bg-black text-white disabled:opacity-50"
      >
        {logout.isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
