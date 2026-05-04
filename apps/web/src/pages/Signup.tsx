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
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create account</h1>

        <div className="space-y-1">
          <label htmlFor="name" className="text-sm">
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500">At least 8 characters.</p>
        </div>

        {register.isError && (
          <p className="text-sm text-red-600">
            Could not create account. Email may already be in use.
          </p>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full border rounded px-3 py-2 bg-black text-white disabled:opacity-50"
        >
          {register.isPending ? "Creating..." : "Create account"}
        </button>

        <p className="text-sm text-center">
          Already have an account?{" "}
          <Link to="/login" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
