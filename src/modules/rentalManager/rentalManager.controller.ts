import { FastifyReply, FastifyRequest } from "fastify";
import { findRentalByUuid } from "../rental/rental.service";

import {
    PostRegisterRentalManagerBody,
    PutActivateRentalManagerBody,
    PutActivateRentalManagerParams,
    PutActivateRentalManagerQuery,
} from "./rentalManager.schema";
import {
    activateRentalManager,
    countRentalManagers,
    registerRentalManager,
} from "./rentalManager.service";

export async function postRegisterRentalManager(
    request: FastifyRequest<{ Body: PostRegisterRentalManagerBody }>,
    reply: FastifyReply,
) {
    const rentalManagerCount = await countRentalManagers();
    if (rentalManagerCount >= 1) {
        return reply.status(409).send({
            message:
                "It is not possible to register more than one rental manager",
        });
    }

    const rental = await findRentalByUuid(request.body.rentalUuid);
    if (!rental) {
        return reply.status(409).send({ message: "Invalid rental uuid" });
    }

    const rentalManager = await registerRentalManager({
        name: request.body.name,
        email: request.body.email,
        password: request.body.password,
        rentalId: rental.id,
    });
    return reply.status(201).send(rentalManager);
}

export async function putActivateRentalManager(
    request: FastifyRequest<{
        Body: PutActivateRentalManagerBody;
        Params: PutActivateRentalManagerParams;
        Querystring: PutActivateRentalManagerQuery;
    }>,
    reply: FastifyReply,
) {
    await activateRentalManager(request.params.uuid, request.query.token);
    return reply.status(204).send();
}
