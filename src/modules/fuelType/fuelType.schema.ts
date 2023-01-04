import { FuelTypeEnum } from "@prisma/client";
import { Type } from "@sinclair/typebox";

export const getAllFuelTypesResponse = Type.Array(
    Type.Object({
        uuid: Type.String({ format: "uuid" }),
        name: Type.Enum(FuelTypeEnum),
    }),
);
