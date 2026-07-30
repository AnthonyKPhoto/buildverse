import { Suspense } from "react";
import { AuthGate } from "./AuthGate";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthGate />
    </Suspense>
  );
}
