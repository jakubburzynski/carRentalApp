import { FastifyInstanceWithTypebox } from "../../loaders/fastify";
import { getAllUnitTypesSchema } from "./unitType.schema";
import { findAllUnitTypes } from "./unitType.service";

export default async function unitTypeRoutes(
    server: FastifyInstanceWithTypebox,
) {
    server.get(
        "/",
        {
            schema: getAllUnitTypesSchema,
        },
        async (request, reply) => {
            const unitTypes = await findAllUnitTypes();
            return reply.status(200).send(unitTypes);
        },
    );
}
