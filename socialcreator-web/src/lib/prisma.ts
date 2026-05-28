import { PrismaClient } from "@prisma/client";

const TIMEOUT_MS = 10_000; // 10 secondes

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prismaClient = globalForPrisma.prisma || new PrismaClient();

// Apply query timeout via $extends (Prisma 6 API)
// Uses $allOperations wildcard to wrap every query with a timeout
prismaClient.$extends({
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        return Promise.race([
          query(args).then((res: unknown) => {
            clearTimeout(timer);
            return res;
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    `Prisma query timed out after ${TIMEOUT_MS}ms on ${model}.${operation}`,
                  ),
                ),
              TIMEOUT_MS,
            );
          }),
        ]) as any;
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export const prisma = prismaClient;
