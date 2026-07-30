"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { UserPlus, User, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

export function SetupForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password || mismatch) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        // Full reload so the freshly-set session cookie is guaranteed to be
        // present for middleware on the next request.
        window.location.href = from;
      } else {
        const data = await res.json();
        setError(data.error || "Couldn't create the admin account");
      }
    } catch {
      setError("Setup failed — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-theme/10 border border-theme/20 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-7 h-7 text-theme" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to BuildVerse</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You're the first one here — create the admin account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-theme/30"
            />
          </div>

          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              Passwords don't match
            </div>
          )}

          <button
            type="submit"
            disabled={!username || !password || mismatch || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-theme text-white font-medium text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Creating account…" : "Create admin account"}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 px-1 pt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          This account becomes the admin — you can add more accounts later from Settings
        </p>
      </div>
    </div>
  );
}
