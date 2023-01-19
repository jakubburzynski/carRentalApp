import { FastifyInstance } from "fastify";

import {
    PostLoginRentalManagerBody,
    postLoginRentalManagerBody,
    postLoginRentalManagerResponse,
} from "./auth.schema";
import { findRentalManagerByLoginCredentials } from "../rentalManager/rentalManager.service";
import { ProcessingException } from "../../utils/processingException.util";

export default async function authRoutes(server: FastifyInstance) {
    server.post<{ Body: PostLoginRentalManagerBody }>(
        "/sessions",
        {
            schema: {
                body: postLoginRentalManagerBody,
                response: {
                    200: postLoginRentalManagerResponse,
                },
            },
        },
        async (request, reply) => {
            if (request.session.authenticated === true) {
                return reply.status(201).send();
            }

            const rentalManager = await findRentalManagerByLoginCredentials(
                request.body.email,
                request.body.password,
            );

            if (!rentalManager.active) {
                throw new ProcessingException(
                    409,
                    "Rental manager account not activated",
                );
            }
            request.session.authenticated = true;
            request.session.rentalManager = {
                uuid: rentalManager.uuid,
                name: rentalManager.name,
            };
            request.session.rental = {
                uuid: rentalManager.rental.uuid,
                name: rentalManager.rental.name,
            };

            return reply.status(201).send();
        },
    );

    server.delete(
        "/sessions",
        {
            preHandler: server.auth([server.isLoggedIn]),
        },
        (request, reply) => {
            request.session.destroy();
            return reply.status(204).send();
        },
    );
}
