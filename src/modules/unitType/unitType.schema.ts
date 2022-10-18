import { UnitTypeEnum } from "@prisma/client";
import { Static, Type } from "@sinclair/typebox";

export const getAllUnitTypesResponse = Type.Array(
    Type.Object({
        uuid: Type.String({ format: "uuid" }),
        name: Type.Enum(UnitTypeEnum),
    }),
);

export type GetAllUnitTypesResponse = Static<typeof getAllUnitTypesResponse>;
