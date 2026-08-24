// Creates and exports the Prisma client used by server-side code.
import { PrismaClient } from "@prisma/client";
import { env } from "./config/env.server";

if (env.nodeEnv !== "production") {
  if (!global.prismaGlobal) {
    // Reuse the same Prisma client in development to avoid extra connections on hot reloads.
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
