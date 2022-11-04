import fastify, { FastifyServerOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { PrismaClient } from "@prisma/client";

import envPlugin, { EnvConfig } from "./env";
import rentalRoutes from "../modules/rental/rental.route";
import prismaPlugin from "./prisma";
import unitTypeRoutes from "../modules/unitType/unitType.route";
import rentalManagerRoutes from "../modules/rentalManager/rentalManager.route";
import { setupMailService } from "./mail";

declare module "fastify" {
    export interface FastifyInstance {
        config: EnvConfig;
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
    await server.register(envPlugin);
    await server.register(prismaPlugin);
    setupMailService(server.config);

    server.register(rentalRoutes, { prefix: "/api/v1/rentals" });
    server.register(rentalManagerRoutes, { prefix: "/api/v1/rental-managers" });
    server.register(unitTypeRoutes, { prefix: "/api/v1/unit-types" });

    server.get("/", async () => {
        return { hello: "world" };
    });

    return server;
}
