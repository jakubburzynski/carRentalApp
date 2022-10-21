import { FastifyInstance } from "fastify";
import { postRegisterRentalManager } from "./rentalManager.controller";

import {
    postRegisterRentalManagerBody,
    postRegisterRentalManagerResponse,
} from "./rentalManager.schema";

export default async function rentalManagerRoutes(server: FastifyInstance) {
    server.post(
        "/",
        {
            schema: {
                body: postRegisterRentalManagerBody,
                response: {
                    201: postRegisterRentalManagerResponse,
                },
            },
        },
        postRegisterRentalManager,
    );
}
