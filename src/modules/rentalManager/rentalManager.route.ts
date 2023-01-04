import { FastifyInstance } from "fastify";

import {
    patchRentalManagerBody,
    PatchRentalManagerBody,
    patchRentalManagerParams,
    PatchRentalManagerParams,
    patchRentalManagerQuery,
    PatchRentalManagerQuery,
    patchRentalManagerResponse,
    PostRegisterRentalManagerBody,
    postRegisterRentalManagerBody,
    postRegisterRentalManagerResponse,
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

    server.patch<{
        Body: PatchRentalManagerBody;
        Params: PatchRentalManagerParams;
        Querystring: PatchRentalManagerQuery;
    }>(
        "/:uuid",
        {
            schema: {
                body: patchRentalManagerBody,
                params: patchRentalManagerParams,
                querystring: patchRentalManagerQuery,
                response: {
                    204: patchRentalManagerResponse,
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
