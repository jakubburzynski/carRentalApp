import { FastifyReply, FastifyRequest } from "fastify";

import { PostCreateRentalBody } from "./rental.schema";
import { createRental } from "./rental.service";

export async function postCreateRental(
    request: FastifyRequest<{ Body: PostCreateRentalBody }>,
    reply: FastifyReply,
) {
    const rental = await createRental({
        name: request.body.name,
        unitTypeUuid: request.body.unitTypeUuid,
    });
    return reply.status(201).send(rental);
}
