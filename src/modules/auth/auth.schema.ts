import { Type } from "@sinclair/typebox";

import { FastifyValidationSchema } from "../../loaders/fastify";

export const postLoginRentalManagerSchema = {
    body: Type.Object({
        email: Type.String({ format: "email" }),
        password: Type.String({ minLength: 1 }),
    }),
    response: {
        201: Type.Null(),
    },
} satisfies FastifyValidationSchema;
