"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5";

const mapAuthError = (code: string | undefined, fallback?: string) => {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "Email already in use";
    case "email_address_invalid":
    case "validation_failed":
      return "Invalid email address";
    case "weak_password":
      return "Password should be at least 6 characters";
    case "invalid_credentials":
      return "Incorrect email or password";
    case "email_not_confirmed":
      return "Please confirm your email before signing in";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return fallback || "Authentication failed. Please try again.";
  }
};

export default function AuthForm({
  next,
  initialError,
}: {
  next: string;
  initialError: string;
}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [supabase] = useState(createClient);

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const handleAuth = async () => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (error) throw error;

        if (!data.session) {
          // Email confirmation is enabled: the user has to click the link first.
          setInfo(`We sent a confirmation link to ${email}.`);
          return;
        }
        toast.success(`Account created: ${email}`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.replace(next);
      router.refresh();
    } catch (err: unknown) {
      console.error("Auth error:", err);
      const { code } = (err ?? {}) as { code?: string };
      setError(mapAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    // On success the browser is redirected to Google, so only errors land here.
    if (error) {
      setError(mapAuthError(error.code, error.message));
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    handleAuth();
  };

  return (
    <div className="relative mx-auto flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#fef3c7_0%,transparent_55%)] px-6 py-8 dark:bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.1)_0%,transparent_55%)]">
      <div className="w-full bg-yellow-200 border-yellow-300 rounded-lg shadow-2xl md:mt-0 sm:max-w-md xl:p-0 relative z-10 rotate-1">
        <div className="transform -translate-y-1/2 w-26 h-8 m-auto bg-white/60 rounded-sm shadow-sm border border-gray-200"></div>
        <Link href="/" className="absolute top-4 left-4" aria-label="Back">
          <ArrowLeft />
        </Link>
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Logo size={40} priority />
            <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl">
              {isSignUp ? "Create an account" : "Sign in to your account"}
            </h1>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full cursor-pointer border-black/10 bg-white text-gray-900 hover:bg-gray-50 hover:text-gray-900"
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="h-px flex-1 bg-yellow-400" />
            or with email
            <div className="h-px flex-1 bg-yellow-400" />
          </div>

          <form className="space-y-4 md:space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Your email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
                placeholder="name@company.com"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Password
              </label>
              <input
                type="password"
                name="password"
                id="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClassName}
                required
              />
            </div>
            {isSignUp && (
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Confirm password
                </label>
                <input
                  type="password"
                  name="confirm-password"
                  id="confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClassName}
                  required
                />
              </div>
            )}
            {error && <div className="text-red-500 text-sm">{error}</div>}
            {info && <div className="text-green-700 text-sm">{info}</div>}
            {isSignUp && (
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="terms"
                    aria-describedby="terms"
                    type="checkbox"
                    className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-primary-300"
                    required
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="font-light text-gray-500">
                    I accept the{" "}
                    <a
                      className="font-medium text-primary-600 hover:underline"
                      href="#"
                    >
                      Terms and Conditions
                    </a>
                  </label>
                </div>
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading
                ? isSignUp
                  ? "Creating account..."
                  : "Signing in..."
                : isSignUp
                  ? "Create an account"
                  : "Sign in"}
            </Button>
            <p className="text-sm font-light text-gray-500 mt-2">
              {isSignUp
                ? "Already have an account? "
                : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                  setInfo("");
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="font-medium text-primary-600 hover:underline cursor-pointer"
              >
                {isSignUp ? "Sign in here" : "Sign up here"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
