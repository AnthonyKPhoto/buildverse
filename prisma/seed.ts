import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding BuildVerse demo data…");

  // Vehicle — 2002 Honda S2000
  const s2000 = await prisma.vehicle.create({
    data: {
      name: "Example S2000",
      year: 2002,
      make: "Honda",
      model: "S2000",
      trim: "AP1",
      platform: "AP1",
      engine: "F20C",
      transmission: "Manual",
      drivetrain: "RWD",
      color: "Silverstone Metallic",
      mileage: 88500,
      notes: "Track-oriented build. HPDE events. Keeping it naturally aspirated.",
    },
  });

  // S2000 modifications
  await prisma.modification.createMany({
    data: [
      {
        vehicleId: s2000.id,
        name: "BC Racing BR Coilovers",
        category: "Suspension",
        brand: "BC Racing",
        vendor: "BC Racing Distributor",
        price: 950,
        actualPrice: 899,
        status: "INSTALLED",
        priority: "HIGH",
        notes: "15-way adjustable damping. Set at 10/15 front, 8/15 rear.",
        difficulty: "INTERMEDIATE",
        installDate: new Date("2022-04-20"),
        installMileage: 72000,
        diyInstall: true,
        laborCost: 0,
      },
      {
        vehicleId: s2000.id,
        name: "Buddy Club P1 Racing Exhaust",
        category: "Exhaust",
        brand: "Buddy Club",
        vendor: "Special Order",
        price: 1100,
        actualPrice: 1100,
        status: "INSTALLED",
        priority: "MEDIUM",
        notes: "Titanium tip. Perfect AP1 fitment. Amazing sound.",
        difficulty: "INTERMEDIATE",
        installDate: new Date("2022-08-05"),
        installMileage: 76000,
        diyInstall: false,
        laborCost: 200,
      },
      {
        vehicleId: s2000.id,
        name: "K&N Drop-In Filter",
        category: "Intake",
        brand: "K&N",
        vendor: "AutoZone",
        price: 65,
        actualPrice: 65,
        status: "INSTALLED",
        priority: "LOW",
        difficulty: "BEGINNER",
        installDate: new Date("2022-04-20"),
        installMileage: 72000,
        diyInstall: true,
      },
      {
        vehicleId: s2000.id,
        name: "Enkei RPF1 18x9 +35 (Set of 4)",
        category: "Wheels",
        brand: "Enkei",
        vendor: "Tire Rack",
        price: 1200,
        actualPrice: 1200,
        status: "INSTALLED",
        priority: "HIGH",
        link: "https://www.tirerack.com",
        notes: "5x114.3, 73.1mm bore. Super lightweight. Perfect fitment.",
        difficulty: "BEGINNER",
        installDate: new Date("2023-03-12"),
        installMileage: 80000,
        diyInstall: false,
        laborCost: 80,
      },
      {
        vehicleId: s2000.id,
        name: "Michelin Pilot Sport 4S 245/40/18",
        category: "Tires",
        brand: "Michelin",
        vendor: "Tire Rack",
        price: 800,
        actualPrice: 800,
        status: "INSTALLED",
        priority: "HIGH",
        link: "https://www.tirerack.com",
        notes: "Set of 4 PS4S. Great wet and dry performance.",
        installDate: new Date("2023-03-12"),
        installMileage: 80000,
        diyInstall: false,
      },
      {
        vehicleId: s2000.id,
        name: "Hardrace Front Lower Control Arms",
        category: "Suspension",
        brand: "Hardrace",
        vendor: "Special Order",
        price: 380,
        status: "PLANNED",
        priority: "HIGH",
        notes: "Adjustable camber. Needed after lowering.",
        difficulty: "INTERMEDIATE",
        diyInstall: true,
      },
      {
        vehicleId: s2000.id,
        name: "Spoon Sports Brake Pads (Front)",
        category: "Brakes",
        brand: "Spoon Sports",
        price: 280,
        status: "RESEARCHING",
        priority: "HIGH",
        notes: "Circuit-grade pads. High initial bite.",
        difficulty: "BEGINNER",
        diyInstall: true,
      },
    ],
  });

  // S2000 budget
  await prisma.budget.createMany({
    data: [
      { vehicleId: s2000.id, category: "Suspension", planned: 1500, actual: 899 },
      { vehicleId: s2000.id, category: "Wheels", planned: 1200, actual: 1200 },
      { vehicleId: s2000.id, category: "Tires", planned: 900, actual: 800 },
      { vehicleId: s2000.id, category: "Exhaust", planned: 1200, actual: 1300 },
      { vehicleId: s2000.id, category: "Brakes", planned: 600, actual: 0 },
      { vehicleId: s2000.id, category: "Intake", planned: 100, actual: 65 },
    ],
  });

  // S2000 maintenance
  await prisma.maintenanceLog.createMany({
    data: [
      {
        vehicleId: s2000.id, service: "Oil Change (5W-30 Full Synthetic)", date: new Date("2024-10-01"),
        mileage: 87000, cost: 65, diy: true,
        nextMiles: 92000, notes: "Motul 8100 X-clean. OEM filter.",
      },
      {
        vehicleId: s2000.id, service: "Alignment", date: new Date("2023-03-15"),
        mileage: 80200, cost: 130, shop: "Performance Alignment Shop", diy: false,
        notes: "-2.0 camber front, -1.5 rear. 0 toe all around.",
      },
      {
        vehicleId: s2000.id, service: "Spark Plugs", date: new Date("2022-12-01"),
        mileage: 78000, cost: 35, diy: true,
        nextMiles: 100000, notes: "NGK Iridium IX plugs. One step colder for track use.",
      },
    ],
  });

  console.log(`✅ Created vehicle: ${s2000.name} (${s2000.year} ${s2000.make} ${s2000.model})`);
  console.log("✅ Seed complete! Open http://localhost:3000 to see your build.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
