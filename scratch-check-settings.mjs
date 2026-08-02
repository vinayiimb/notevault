import { PrismaClient } from "./src/generated/prisma/index.js";
const prisma = new PrismaClient();
const updated = await prisma.siteSettings.update({
  where: { id: "singleton" },
  data: {
    heroEyebrow: "DU PYQ",
    heroSubtitle: null,
    heroSearchCaption: null,
  },
});
console.log(JSON.stringify(updated, null, 2));
await prisma.$disconnect();
