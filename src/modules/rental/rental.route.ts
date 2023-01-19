import { FastifyInstanceWithTypebox } from "../../loaders/fastify";
import { postCreateRentalSchema } from "./rental.schema";
import { createRental } from "./rental.service";

export default async function rentalRoutes(server: FastifyInstanceWithTypebox) {
    server.post(
        "/",
        {
            schema: postCreateRentalSchema,
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
