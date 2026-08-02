import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();

async function main() {
  const subjects = await prisma.subject.findMany({
    select: { id: true, name: true, upc: true, driveSubjects: { select: { id: true } }, notes: { select: { id: true } } },
    orderBy: { name: 'asc' }
  });
  
  console.log('Total subjects in DB:', subjects.length);
  const withUpc = subjects.filter(s => s.upc);
  const withDrive = subjects.filter(s => s.driveSubjects.length > 0);
  const withNotes = subjects.filter(s => s.notes);
  
  console.log('With UPC:', withUpc.length);
  console.log('With Drive content (LIVE):', withDrive.length);
  console.log('With Notes:', withNotes.length);
  
  console.log('\nUPC Subjects (upc | name | driveFiles | hasNotes):');
  withUpc.forEach(s => console.log(`${s.upc} | ${s.name} | drive:${s.driveSubjects.length} | notes:${s.notes?'Y':'N'}`));
}
main().catch(e => console.error(e.message)).finally(() => prisma.$disconnect());
