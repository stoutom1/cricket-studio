//import { PrismaClient } from '@prisma/client';
//import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalForPrisma = globalThis;
const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"],
});

const prisma =
  globalForPrisma.prisma || new PrismaClient({ adapter })

//  new PrismaClient({
//   accelerateUrl: process.env["DATABASE_URL"],
//}).$extends(withAccelerate())
  //new PrismaClient({
  //  log: ["warn", "error"]
  //});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;