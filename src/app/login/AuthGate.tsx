"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "./LoginForm";
import { SetupForm } from "./SetupForm";

// Decides whether to show "sign in" or "create the admin account" — the
// latter only ever applies once, right after a fresh server deployment
// before anyone has an account yet. See /api/auth/setup-status.
export function AuthGate() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/setup-status")
      .then((res) => res.json())
      .then((data) => setNeedsSetup(!!data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (needsSetup === null) return null;
  return needsSetup ? <SetupForm /> : <LoginForm />;
}
