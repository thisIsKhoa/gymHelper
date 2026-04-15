import { recordDailyAppOpen } from './src/modules/gamification/gamification.service.js';
import { prisma } from './src/db/prisma.js';

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("No user found");
    
    console.log(`Pinging for user: ${user.id}`);
    const start = Date.now();
    await recordDailyAppOpen(user.id);
    const end = Date.now();
    console.log(`Success in ${end - start}ms`);
  } catch(error: any) {
    console.error("FAILED WITH ERROR:", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
