import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const googleEnabled   = !!process.env.GOOGLE_AUTH_CLIENT_ID;
  const passwordEnabled = !!process.env.BUILDVERSE_REMOTE_PASSWORD_HASH;
  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={googleEnabled} passwordEnabled={passwordEnabled} />
    </Suspense>
  );
}
