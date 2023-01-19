import { UnitTypeEnum } from "@prisma/client";
import { Type } from "@sinclair/typebox";

import { FastifyValidationSchema } from "../../loaders/fastify";

export const getAllUnitTypesSchema = {
    response: {
        200: Type.Array(
            Type.Object({
                uuid: Type.String({ format: "uuid" }),
                name: Type.Enum(UnitTypeEnum),
            }),
        ),
    },
} satisfies FastifyValidationSchema;
