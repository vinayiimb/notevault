// Seeds the 5 named preset themes (Scholar Blue, Botanical, Lavender Study,
// Rose Ink, Midnight Focus) plus the "Default" theme (mirrors the site's
// original fixed note design system) as the live GLOBAL default — all
// marked isPreset so they're never deletable, only duplicatable. Safe to
// re-run: upserted on name (a GLOBAL preset's name is effectively unique).
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { NOTE_THEME_PRESETS } from "../src/lib/note-theme";

const prisma = new PrismaClient();

async function main() {
  for (const preset of NOTE_THEME_PRESETS) {
    const existing = await prisma.noteTheme.findFirst({
      where: { scope: "GLOBAL", isPreset: true, name: preset.name },
    });
    const data = {
      name: preset.name,
      scope: "GLOBAL" as const,
      isPreset: true,
      isDefaultGlobal: !!preset.isDefaultGlobal,
      draftJson: preset.values,
      publishedJson: preset.values,
    };
    if (existing) {
      await prisma.noteTheme.update({ where: { id: existing.id }, data });
      console.log(`Updated preset "${preset.name}"`);
    } else {
      await prisma.noteTheme.create({ data });
      console.log(`Created preset "${preset.name}"`);
    }
  }
  console.log(`\nDone. ${NOTE_THEME_PRESETS.length} preset themes seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
