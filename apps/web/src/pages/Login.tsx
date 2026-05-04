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
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {login.isError && (
          <p className="text-sm text-red-600">Invalid email or password.</p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full border rounded px-3 py-2 bg-black text-white disabled:opacity-50"
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-sm text-center">
          No account?{" "}
          <Link to="/signup" className="underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
