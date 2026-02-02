
"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Only create Supabase client on the client side
  const supabase = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 bg-background-elevated p-8 rounded-2xl border border-border shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-accent/10 mb-4">
            <Lock className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Admin Access
          </h1>
          <p className="text-foreground-muted">
            Enter your credentials to access the dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground-muted ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background-secondary border border-border rounded-xl text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
                  placeholder="admin@audico.ai"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground-muted ml-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background-secondary border border-border rounded-xl text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3 px-4 bg-accent hover:bg-accent-hover text-background font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Sign In"
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background-elevated px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={async () => {
              if (!supabase) return;
              setIsLoading(true);
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/admin/quotes`
                }
              });
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-background-secondary hover:bg-background-tertiary border border-border rounded-xl transition-all duration-200 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>
        </form>

        <div className="text-center">
          <a href="/" className="text-sm text-foreground-muted hover:text-accent transition-colors">
            ← Back to Chat Quote
          </a>
        </div>
      </div>
    </div>
  );
}
