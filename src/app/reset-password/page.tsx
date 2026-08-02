"use client";

import { Suspense, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

export const dynamic = "force-dynamic";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || mismatch || !token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (res.ok) {
        // Full reload so the freshly-set session cookie is guaranteed to be
        // present for middleware on the next request.
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error || "Couldn't reset password");
      }
    } catch {
      setError("Something went wrong — try again");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        This reset link is missing its token — use the link from your email, or{" "}
        <a href="/forgot-password" className="text-theme hover:underline">request a new one</a>.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <input
          type={showPw ? "text" : "password"}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full px-4 py-3 pr-11 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-theme/30"
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <input
        type={showPw ? "text" : "password"}
        placeholder="Confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full px-4 py-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-theme/30"
      />
      {mismatch && (
        <div className="flex items-center gap-2 text-xs text-red-400 px-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Passwords don&apos;t match
        </div>
      )}

      <button
        type="submit"
        disabled={!password || mismatch || loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-theme text-white font-medium text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Saving…" : "Set new password"}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 px-1 pt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-theme/10 border border-theme/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-theme" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a new password for your account</p>
        </div>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
