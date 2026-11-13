// Runs once when the Next.js server process starts (not during `next build`).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPriceScheduler } = await import("@/lib/price-scheduler");
    startPriceScheduler();
  }
}
