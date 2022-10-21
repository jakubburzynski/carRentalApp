import fastify, { FastifyServerOptions } from "fastify";
import fastifyEnv from "@fastify/env";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { PrismaClient } from "@prisma/client";

import envSchema, { EnvSchema } from "./env";
import rentalRoutes from "../modules/rental/rental.route";
import prismaPlugin from "./prisma";
import unitTypeRoutes from "../modules/unitType/unitType.route";
import rentalManagerRoutes from "../modules/rentalManager/rentalManager.route";

declare module "fastify" {
    interface FastifyInstance {
        config: EnvSchema;
        prisma: PrismaClient;
    }
}

export default async function createFastifyServer(
    options: FastifyServerOptions = {},
) {
    const server = fastify({
        ...options,
        ajv: {
            customOptions: {
                removeAdditional: "all",
            },
        },
    }).withTypeProvider<TypeBoxTypeProvider>();
    await server.register(fastifyEnv, {
        schema: envSchema,
        dotenv: true,
        data: process.env,
    });
    await server.register(prismaPlugin);

    server.register(rentalRoutes, { prefix: "/api/v1/rentals" });
    server.register(rentalManagerRoutes, { prefix: "/api/v1/rental-managers" });
    server.register(unitTypeRoutes, { prefix: "/api/v1/unit-types" });

    server.get("/", async () => {
        return { hello: "world" };
    });

    return server;
}
