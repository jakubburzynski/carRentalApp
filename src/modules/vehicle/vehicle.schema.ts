import { Type } from "@sinclair/typebox";

import { FastifyValidationSchema } from "../../loaders/fastify";

export const postCreateVehicleSchema = {
    body: Type.Object({
        brand: Type.String({ minLength: 2 }),
        model: Type.String({ minLength: 1 }),
        year: Type.Number({
            minimum: 1900,
            maximum: new Date().getFullYear() + 1,
        }),
        description: Type.Optional(Type.String({ minLength: 3 })),
        mileage: Type.Number({ minimum: 1 }),
        licensePlate: Type.String({ minLength: 1, maxLength: 20 }),
        pricePerDay: Type.Number({ minimum: 1 }),
        name: Type.Optional(Type.String({ minLength: 3 })),
        fuelTypeUuid: Type.String({ format: "uuid" }),
    }),
    response: {
        201: Type.Object({
            uuid: Type.String({ format: "uuid" }),
            name: Type.String(),
        }),
    },
} satisfies FastifyValidationSchema;
