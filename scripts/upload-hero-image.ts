import { readFileSync } from "fs";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Usage: npx tsx scripts/upload-hero-image.ts <path-to-image>");
    process.exit(1);
  }

  const imageBuffer = readFileSync(imagePath);
  const fileName = imagePath.split("/").pop();

  console.log(`Uploading ${fileName}...`);
  const { put } = await import("@vercel/blob");
  const blob = await put(`hero-images/${fileName}`, imageBuffer, {
    access: "public",
    contentType: "image/png",
  });

  console.log("✓ Uploaded to:", blob.url);

  const settings = await prisma.siteSettings.findFirst();
  if (!settings) {
    console.log("Creating SiteSettings...");
    await prisma.siteSettings.create({
      data: { heroImageUrl: blob.url },
    });
  } else {
    await prisma.siteSettings.update({
      where: { id: settings.id },
      data: { heroImageUrl: blob.url },
    });
  }

  console.log("✓ Updated SiteSettings.heroImageUrl");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
