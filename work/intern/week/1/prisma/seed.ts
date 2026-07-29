import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ethiotelecom.et" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@ethiotelecom.et",
      password,
      role: "ADMIN",
    },
  });

  const tech = await prisma.user.upsert({
    where: { email: "tech@ethiotelecom.et" },
    update: {},
    create: {
      name: "Abebe Technician",
      email: "tech@ethiotelecom.et",
      password,
      role: "TECHNICIAN",
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      name: "Sara Customer",
      email: "customer@example.com",
      phone: "+251900000000",
      password,
      role: "CUSTOMER",
    },
  });

  console.log("Seeded users (password: password123):");
  console.log({ admin: admin.email, tech: tech.email, customer: customer.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
