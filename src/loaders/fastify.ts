import fastify, { FastifyServerOptions } from "fastify";
import fastifyEnv from "@fastify/env";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

import envSchema, { EnvSchema } from "./env";
import rentalRoutes from "../modules/rental/rental.route";

declare module "fastify" {
    interface FastifyInstance {
        config: EnvSchema;
    }
}

export default async function createFastifyServer(
    options: FastifyServerOptions = {},
) {
    const server = fastify(options).withTypeProvider<TypeBoxTypeProvider>();
    await server.register(fastifyEnv, {
        schema: envSchema,
        dotenv: true,
        data: process.env,
    });

    server.register(rentalRoutes, { prefix: "/api/v1/rental" });

    server.get("/", async () => {
        return { hello: "world" };
    });

    return server;
}
