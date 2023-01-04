import { FastifyInstance } from "fastify";

import { getAllFuelTypesResponse } from "./fuelType.schema";
import { findAllFuelTypes } from "./fuelType.service";

export default async function fuelTypeRoutes(server: FastifyInstance) {
    server.get(
        "/",
        {
            schema: {
                response: {
                    200: getAllFuelTypesResponse,
                },
            },
        },
        async (request, reply) => {
            const fuelTypes = await findAllFuelTypes();
            return reply.status(200).send(fuelTypes);
        },
    );
}
