import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { FastifyReply, FastifyRequest } from "fastify";
import { PostCreateRentalBody } from "./rental.schema";
import { countRentals, createRental } from "./rental.service";

export async function postCreateRental(
    request: FastifyRequest<{ Body: PostCreateRentalBody }>,
    reply: FastifyReply,
) {
    try {
        const rentalCount = await countRentals();
        if (rentalCount >= 1) {
            return reply.status(409).send({
                message: "It is not possible to create more than one rental",
            });
        }

        const rental = await createRental(request.body);
        return reply.status(201).send(rental);
    } catch (err) {
        if (err instanceof PrismaClientKnownRequestError) {
            if (err.code === "P2003") {
                return reply
                    .status(409)
                    .send({ message: "Invalid unit type id" });
            }
        }
        throw err;
    }
}
