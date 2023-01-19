import { FastifyInstanceWithTypebox } from "../../loaders/fastify";
import {
    patchRentalManagerSchema,
    postRegisterRentalManagerSchema,
} from "./rentalManager.schema";
import {
    activateRentalManager,
    registerRentalManager,
} from "./rentalManager.service";

export default async function rentalManagerRoutes(
    server: FastifyInstanceWithTypebox,
) {
    server.post(
        "/",
        {
            schema: postRegisterRentalManagerSchema,
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

    server.patch(
        "/:uuid",
        {
            schema: patchRentalManagerSchema,
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
