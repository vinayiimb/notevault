import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const heroUrl = "/images/hero-du-colleges.png";
  
  const settings = await prisma.siteSettings.findFirst();
  if (!settings) {
    console.log("Creating SiteSettings...");
    await prisma.siteSettings.create({
      data: { heroImageUrl: heroUrl },
    });
  } else {
    await prisma.siteSettings.update({
      where: { id: settings.id },
      data: { heroImageUrl: heroUrl },
    });
  }

  console.log("✓ Updated SiteSettings.heroImageUrl to:", heroUrl);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
