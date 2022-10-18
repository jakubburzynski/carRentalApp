import { FastifyInstance } from "fastify";
import { getAllUnitTypes } from "./unitType.controller";
import { getAllUnitTypesResponse } from "./unitType.schema";

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
        getAllUnitTypes,
    );
}
