import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
const prismaPlugin: FastifyPluginAsync = fp(async (server) => {
    await prisma.$connect();

    server.decorate("prisma", prisma);

    server.addHook("onClose", async (server) => {
        await server.prisma.$disconnect();
    });
});

export default prismaPlugin;
