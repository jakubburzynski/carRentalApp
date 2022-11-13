import { FastifyInstance } from "fastify";

import {
    PostCreateRentalBody,
    postCreateRentalBody,
    postCreateRentalResponse,
} from "./rental.schema";
import { createRental } from "./rental.service";

export default async function rentalRoutes(server: FastifyInstance) {
    server.post<{ Body: PostCreateRentalBody }>(
        "/",
        {
            schema: {
                body: postCreateRentalBody,
                response: {
                    201: postCreateRentalResponse,
                },
            },
        },
        async (request, reply) => {
            const rental = await createRental({
                name: request.body.name,
                unitTypeUuid: request.body.unitTypeUuid,
            });
            return reply.status(201).send(rental);
        },
    );
}
