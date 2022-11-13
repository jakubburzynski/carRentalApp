import { FastifyInstance } from "fastify";

import {
    PostRegisterRentalManagerBody,
    postRegisterRentalManagerBody,
    postRegisterRentalManagerResponse,
    PutActivateRentalManagerBody,
    putActivateRentalManagerBody,
    PutActivateRentalManagerParams,
    putActivateRentalManagerParams,
    PutActivateRentalManagerQuery,
    putActivateRentalManagerQuery,
    putActivateRentalManagerResponse,
} from "./rentalManager.schema";
import {
    activateRentalManager,
    registerRentalManager,
} from "./rentalManager.service";

export default async function rentalManagerRoutes(server: FastifyInstance) {
    server.post<{
        Body: PostRegisterRentalManagerBody;
    }>(
        "/",
        {
            schema: {
                body: postRegisterRentalManagerBody,
                response: {
                    201: postRegisterRentalManagerResponse,
                },
            },
        },
        async (request, reply) => {
            const rentalManager = await registerRentalManager({
                name: request.body.name,
                email: request.body.email,
                password: request.body.password,
                rentalUuid: request.body.rentalUuid,
            });
            return reply.status(201).send(rentalManager);
        },
    );

    server.put<{
        Body: PutActivateRentalManagerBody;
        Params: PutActivateRentalManagerParams;
        Querystring: PutActivateRentalManagerQuery;
    }>(
        "/:uuid/active",
        {
            schema: {
                body: putActivateRentalManagerBody,
                params: putActivateRentalManagerParams,
                querystring: putActivateRentalManagerQuery,
                response: {
                    204: putActivateRentalManagerResponse,
                },
            },
        },
        async (request, reply) => {
            await activateRentalManager(
                request.params.uuid,
                request.query.token,
            );
            return reply
                .status(204)
                .header("Referrer-Policy", "no-referrer")
                .send();
        },
    );
}
