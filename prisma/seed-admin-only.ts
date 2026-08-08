// Creates (or updates) a single Admin row from ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD.
// Unlike seed.ts, this touches ONLY the Admin table — no deleteMany() on
// Program/Term/Subject/Resource/Question/Admin, safe to run against a
// database that already has real imported data (e.g. Supabase staging
// after the Phase 2D/2E catalogue import).
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? "admin@notevault.dev";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.upsert({
    where: { email },
    create: { email, name: "Admin", passwordHash },
    update: { passwordHash },
  });

  console.log(`Admin ready: ${admin.email} (id=${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
