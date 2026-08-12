import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma/index.js";
const prisma = new PrismaClient();
const settings = await prisma.siteSettings.findFirst();
console.log("Database siteSettings:", JSON.stringify(settings, null, 2));
await prisma.$disconnect();
