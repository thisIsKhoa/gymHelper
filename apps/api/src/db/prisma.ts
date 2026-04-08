import { PrismaClient } from '@prisma/client';

import { env } from '../config/env.js';

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

function withConnectionTuning(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);

    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', env.NODE_ENV === 'production' ? '5' : '1');
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '20');
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

const tunedDatabaseUrl = withConnectionTuning(env.DATABASE_URL);

export const prisma =
  global.prismaClient ??
  new PrismaClient({
    datasources: {
      db: {
        url: tunedDatabaseUrl,
      },
    },
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaClient = prisma;
}
