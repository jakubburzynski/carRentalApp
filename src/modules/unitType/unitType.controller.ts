import { FastifyReply, FastifyRequest } from "fastify";
import { findAllUnitTypes } from "./unitType.service";

export async function getAllUnitTypes(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    const unitTypes = await findAllUnitTypes();
    return reply.status(200).send(unitTypes);
}
