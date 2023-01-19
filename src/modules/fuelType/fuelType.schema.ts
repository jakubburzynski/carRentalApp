import { FuelTypeEnum } from "@prisma/client";
import { Type } from "@sinclair/typebox";

import { FastifyValidationSchema } from "../../loaders/fastify";

export const getAllFuelTypesSchema = {
    response: {
        200: Type.Array(
            Type.Object({
                uuid: Type.String({ format: "uuid" }),
                name: Type.Enum(FuelTypeEnum),
            }),
        ),
    },
} satisfies FastifyValidationSchema;
