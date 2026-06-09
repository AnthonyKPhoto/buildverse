const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: "file:./dev.db" } } });

async function wipe() {
  await prisma.modDependency.deleteMany({});
  await prisma.modification.deleteMany({});
  await prisma.maintenanceLog.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.priceHistory.deleteMany({});
  await prisma.trackedProduct.deleteMany({});
  const v = await prisma.vehicle.count();
  console.log("Vehicles remaining in dev.db:", v);
  await prisma.$disconnect();
}

wipe().catch((e) => { console.error(e); process.exit(1); });
