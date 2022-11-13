import { FastifyInstance } from "fastify";

import { getAllUnitTypesResponse } from "./unitType.schema";
import { findAllUnitTypes } from "./unitType.service";

export default async function unitTypeRoutes(server: FastifyInstance) {
    server.get(
        "/",
        {
            schema: {
                response: {
                    200: getAllUnitTypesResponse,
                },
            },
        },
        async (request, reply) => {
            const unitTypes = await findAllUnitTypes();
            return reply.status(200).send(unitTypes);
        },
    );
}
