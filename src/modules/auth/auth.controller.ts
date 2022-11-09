import { FastifyReply, FastifyRequest } from "fastify";

import { findRentalManagerByLoginCredentials } from "../rentalManager/rentalManager.service";
import { PostLoginRentalManagerBody } from "./auth.schema";

export async function postLoginRentalManager(
    request: FastifyRequest<{ Body: PostLoginRentalManagerBody }>,
    reply: FastifyReply,
) {
    if (request.session.authenticated === true) {
        return reply.status(201).send();
    }

    const rentalManager = await findRentalManagerByLoginCredentials(
        request.body.email,
        request.body.password,
    );

    if (!rentalManager.active) {
        return reply
            .status(409)
            .send({ message: "Rental manager account not activated" });
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
}

export async function deleteLogoutRentalManager(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    request.session.destroy();
    return reply.status(204).send();
}
