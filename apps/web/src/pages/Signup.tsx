import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRegister } from "../hooks/useAuth";

export default function Signup() {
  const navigate = useNavigate();
  const register = useRegister();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    register.mutate(
      { name, email, password },
      { onSuccess: () => navigate("/") },
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold">Create account</h1>

        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <p className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        </div>

        {register.isError && (
          <p className="text-sm text-destructive">
            Could not create account. Email may already be in use.
          </p>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {register.isPending ? "Creating..." : "Create account"}
        </button>

        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
