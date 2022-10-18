import { FastifyReply, FastifyRequest } from "fastify";
import { findUnitTypeByUuid } from "../unitType/unitType.service";
import { PostCreateRentalBody } from "./rental.schema";
import { countRentals, createRental } from "./rental.service";

export async function postCreateRental(
    request: FastifyRequest<{ Body: PostCreateRentalBody }>,
    reply: FastifyReply,
) {
    const rentalCount = await countRentals();
    if (rentalCount >= 1) {
        return reply.status(409).send({
            message: "It is not possible to create more than one rental",
        });
    }

    const unitType = await findUnitTypeByUuid(request.body.unitTypeUuid);
    if (!unitType) {
        return reply.status(409).send({ message: "Invalid unit type uuid" });
    }

    const rental = await createRental({
        name: request.body.name,
        unitTypeId: unitType.id,
    });
    return reply.status(201).send(rental);
}
