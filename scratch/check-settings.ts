import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 'singleton' },
  });
  console.log('Site Settings in DB:', settings);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
