import { Type } from "@sinclair/typebox";

import { FastifyValidationSchema } from "../../loaders/fastify";

export const postCreateVehicleEquipmentSchema = {
    body: Type.Object({
        name: Type.String({ minLength: 2 }),
    }),
    params: Type.Object({
        uuid: Type.String({ format: "uuid" }),
    }),
    response: {
        201: Type.Object({
            uuid: Type.String({ format: "uuid" }),
            name: Type.String(),
        }),
    },
} satisfies FastifyValidationSchema;

export const patchVehicleEquipmentSchema = {
    body: Type.Object({
        name: Type.String({ minLength: 2 }),
    }),
    params: Type.Object({
        vehicleUuid: Type.String({ format: "uuid" }),
        equipmentUuid: Type.String({ format: "uuid" }),
    }),
    response: {
        204: Type.Null(),
    },
} satisfies FastifyValidationSchema;

export const deleteVehicleEquipmentSchema = {
    params: Type.Object({
        vehicleUuid: Type.String({ format: "uuid" }),
        equipmentUuid: Type.String({ format: "uuid" }),
    }),
    response: {
        204: Type.Null(),
    },
} satisfies FastifyValidationSchema;
