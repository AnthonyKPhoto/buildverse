"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || "Something went wrong — try again");
      }
    } catch {
      setError("Something went wrong — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-theme/10 border border-theme/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-theme" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your username and we&apos;ll email you a reset link
          </p>
        </div>

        {sent ? (
          <div className="flex items-start gap-2 text-sm rounded-xl border border-theme/20 bg-theme/10 text-foreground p-4">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-theme" />
            <span>If that account exists and has an email on file, a reset link has been sent. It expires in 30 minutes.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full px-4 py-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-theme/30"
            />

            <button
              type="submit"
              disabled={!username || loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-theme text-white font-medium text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Sending…" : "Send reset link"}
            </button>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-1 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/login" className="hover:text-foreground underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
