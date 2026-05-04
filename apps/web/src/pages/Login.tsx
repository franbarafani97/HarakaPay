import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogin } from "../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate("/") });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold">Sign in</h1>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        {login.isError && (
          <p className="text-sm text-destructive">Invalid email or password.</p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-sm text-center text-muted-foreground">
          No account?{" "}
          <Link
            to="/signup"
            className="text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
