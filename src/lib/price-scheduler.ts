import { getPriceAlertSettings, runPriceCheck } from "@/lib/price-tracker";

// Background price checks. Started once per server process from
// src/instrumentation.ts. Every 15 minutes it asks runPriceCheck() to handle
// whatever is "due" (older than the configured interval), so prices — and
// email alerts — keep working when nobody has the app open.

const TICK_MS = 15 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000; // let the server finish booting first

export function startPriceScheduler() {
  const g = globalThis as unknown as { __bvPriceSchedulerStarted?: boolean };
  if (g.__bvPriceSchedulerStarted) return; // dev hot-reload / double register
  g.__bvPriceSchedulerStarted = true;

  const tick = async () => {
    try {
      const settings = await getPriceAlertSettings();
      if (!settings.autoCheck) return;
      const res = await runPriceCheck();
      if (res.checked > 0 || res.alerts > 0) {
        console.log(`[price-tracker] checked ${res.checked} (${res.failed} problems), ${res.alerts} alert(s), emailed: ${res.emailed}`);
      }
    } catch (err) {
      console.error("[price-tracker] background check failed:", err instanceof Error ? err.message : err);
    }
  };

  setTimeout(tick, FIRST_RUN_DELAY_MS).unref?.();
  setInterval(tick, TICK_MS).unref?.();
}
