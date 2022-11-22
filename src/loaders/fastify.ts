import fastify, { FastifyServerOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { PrismaClient, Rental, RentalManager } from "@prisma/client";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import fastifyMultipart from "@fastify/multipart";
import fastifyAuth, { FastifyAuthFunction } from "@fastify/auth";
import { S3Client } from "@aws-sdk/client-s3";

import envPlugin, { EnvConfig } from "./env";
import prismaPlugin from "./prisma";
import rentalRoutes from "../modules/rental/rental.route";
import unitTypeRoutes from "../modules/unitType/unitType.route";
import rentalManagerRoutes from "../modules/rentalManager/rentalManager.route";
import authRoutes from "../modules/auth/auth.route";
import vehicleRoutes from "../modules/vehicle/vehicle.route";
import { setupMailService } from "./mail";
import generateRandomToken from "../utils/randomToken.util";
import { isLoggedIn } from "../modules/auth/auth.middleware";
import S3Plugin from "./s3";

declare module "fastify" {
    export interface FastifyInstance {
        config: EnvConfig;
        prisma: PrismaClient;
        isLoggedIn: FastifyAuthFunction;
        s3: S3Client;
    }
    export interface Session {
        authenticated: boolean;
        rentalManager: Pick<RentalManager, "uuid" | "name">;
        rental: Pick<Rental, "uuid" | "name">;
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
    await server.register(prismaPlugin);
    server.register(envPlugin);
    await server.after();
    server.register(fastifyCookie);
    server.register(fastifySession, {
        cookieName: "sessionId",
        cookie: {
            secure: server.config.SERVER_HTTPS,
            httpOnly: true,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        },
        secret: await generateRandomToken(64),
        saveUninitialized: false,
    });
    server.register(fastifyMultipart);
    server.register(S3Plugin);
    server.decorate("isLoggedIn", isLoggedIn);
    server.register(fastifyAuth);
    setupMailService(server.config);

    server.register(authRoutes, { prefix: "/api/v1/auth" });
    server.register(rentalRoutes, { prefix: "/api/v1/rentals" });
    server.register(rentalManagerRoutes, { prefix: "/api/v1/rental-managers" });
    server.register(vehicleRoutes, { prefix: "/api/v1/vehicles" });
    server.register(unitTypeRoutes, { prefix: "/api/v1/unit-types" });

    return server;
}
