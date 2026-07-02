import { prisma } from "@/lib/prisma";

export async function storePkce(state: string, verifier: string, clientId: string): Promise<void> {
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await prisma.setting.upsert({
    where:  { key: `pkce_${state}` },
    create: { key: `pkce_${state}`, value: JSON.stringify({ verifier, clientId, expiresAt }) },
    update: { value: JSON.stringify({ verifier, clientId, expiresAt }) },
  });
  // Purge any expired states while we're here
  const all = await prisma.setting.findMany({ where: { key: { startsWith: "pkce_" } } });
  const now = Date.now();
  for (const row of all) {
    try {
      if ((JSON.parse(row.value) as { expiresAt: number }).expiresAt < now) {
        await prisma.setting.delete({ where: { key: row.key } });
      }
    } catch { /* ignore malformed rows */ }
  }
}

export async function consumePkce(state: string): Promise<{ verifier: string; clientId: string } | null> {
  const row = await prisma.setting.findUnique({ where: { key: `pkce_${state}` } });
  if (!row) return null;
  try {
    const data = JSON.parse(row.value) as { verifier: string; clientId: string; expiresAt: number };
    await prisma.setting.delete({ where: { key: `pkce_${state}` } });
    if (data.expiresAt < Date.now()) return null;
    return { verifier: data.verifier, clientId: data.clientId };
  } catch {
    return null;
  }
}
