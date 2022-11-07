import { FastifyReply, FastifyRequest } from "fastify";

import {
    PostRegisterRentalManagerBody,
    PutActivateRentalManagerBody,
    PutActivateRentalManagerParams,
    PutActivateRentalManagerQuery,
} from "./rentalManager.schema";
import {
    activateRentalManager,
    registerRentalManager,
} from "./rentalManager.service";

export async function postRegisterRentalManager(
    request: FastifyRequest<{ Body: PostRegisterRentalManagerBody }>,
    reply: FastifyReply,
) {
    const rentalManager = await registerRentalManager({
        name: request.body.name,
        email: request.body.email,
        password: request.body.password,
        rentalUuid: request.body.rentalUuid,
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
    return reply.status(204).header("Referrer-Policy", "no-referrer").send();
}
