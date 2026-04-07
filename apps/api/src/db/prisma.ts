import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

export const prisma =
  global.prismaClient ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaClient = prisma;
}
