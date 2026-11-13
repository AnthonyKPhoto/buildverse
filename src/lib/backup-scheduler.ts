import { runScheduledBackup } from "@/lib/backup";

// Started once per server process from src/instrumentation.ts. Checks every
// 30 minutes whether a scheduled backup is due (the newest backup is older than
// the configured interval), so it keeps working through restarts and sleep.

const TICK_MS = 30 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 3 * 60 * 1000;

export function startBackupScheduler() {
  const g = globalThis as unknown as { __bvBackupSchedulerStarted?: boolean };
  if (g.__bvBackupSchedulerStarted) return;
  g.__bvBackupSchedulerStarted = true;

  const tick = async () => {
    try {
      const made = await runScheduledBackup();
      if (made) console.log(`[backup] created ${made.name} (${Math.round(made.size / 1024)} KB)`);
    } catch (err) {
      console.error("[backup] scheduled backup failed:", err instanceof Error ? err.message : err);
    }
  };

  setTimeout(tick, FIRST_RUN_DELAY_MS).unref?.();
  setInterval(tick, TICK_MS).unref?.();
}
