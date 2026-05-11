import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLogin } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import logoUrl from "../assets/harakapay-icon.jpg";

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
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img
            src={logoUrl}
            alt="HarakaPay"
            className="h-20 w-20 rounded-xl mb-3"
          />
          <CardTitle>Sign in to HarakaPay</CardTitle>
          <CardDescription>
            Use your email and password to continue.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {login.isError && (
              <p className="text-sm text-destructive">
                Invalid email or password.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 items-stretch">
            <Button type="submit" disabled={login.isPending} className="w-full">
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              No account?{" "}
              <Link
                to="/signup"
                className="text-primary underline-offset-4 hover:underline"
              >
                Create one
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
