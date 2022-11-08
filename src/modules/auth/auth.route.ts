import { FastifyInstance } from "fastify";

import { postLoginRentalManager } from "./auth.controller";
import {
    postLoginRentalManagerBody,
    postLoginRentalManagerResponse,
} from "./auth.schema";

export default async function authRoutes(server: FastifyInstance) {
    server.post(
        "/sessions",
        {
            schema: {
                body: postLoginRentalManagerBody,
                response: {
                    200: postLoginRentalManagerResponse,
                },
            },
        },
        postLoginRentalManager,
    );
}
