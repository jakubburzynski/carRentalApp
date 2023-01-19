import { Type } from "@sinclair/typebox";

import { FastifyValidationSchema } from "../../loaders/fastify";

export const postCreateRentalSchema = {
    body: Type.Object({
        name: Type.String({ minLength: 3 }),
        unitTypeUuid: Type.String({ format: "uuid" }),
    }),
    response: {
        201: Type.Object({
            uuid: Type.String({ format: "uuid" }),
            name: Type.String(),
        }),
    },
} satisfies FastifyValidationSchema;
