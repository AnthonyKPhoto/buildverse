const { PrismaClient } = require("@prisma/client");

const dbPath = process.argv[2] || "prisma/dev.db";
const client = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function main() {
  const deps = await client.modDependency.deleteMany({});
  const mods = await client.modification.deleteMany({});
  const vehs = await client.vehicle.deleteMany({});
  console.log(`Wiped: ${vehs.count} vehicles, ${mods.count} mods, ${deps.count} deps`);
  await client.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
