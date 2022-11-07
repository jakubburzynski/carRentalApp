import { FastifyInstance } from "fastify";

import {
    postRegisterRentalManagerBody,
    postRegisterRentalManagerResponse,
    putActivateRentalManagerBody,
    putActivateRentalManagerParams,
    putActivateRentalManagerQuery,
    putActivateRentalManagerResponse,
} from "./rentalManager.schema";
import {
    postRegisterRentalManager,
    putActivateRentalManager,
} from "./rentalManager.controller";

export default async function rentalManagerRoutes(server: FastifyInstance) {
    server.post(
        "/",
        {
            schema: {
                body: postRegisterRentalManagerBody,
                response: {
                    201: postRegisterRentalManagerResponse,
                },
            },
        },
        postRegisterRentalManager,
    );

    server.put(
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
        putActivateRentalManager,
    );
}
