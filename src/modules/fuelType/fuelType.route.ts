import { FastifyInstanceWithTypebox } from "../../loaders/fastify";
import { getAllFuelTypesSchema } from "./fuelType.schema";
import { findAllFuelTypes } from "./fuelType.service";

export default async function fuelTypeRoutes(
    server: FastifyInstanceWithTypebox,
) {
    server.get(
        "/",
        {
            schema: getAllFuelTypesSchema,
        },
        async (request, reply) => {
            const fuelTypes = await findAllFuelTypes();
            return reply.status(200).send(fuelTypes);
        },
    );
}
