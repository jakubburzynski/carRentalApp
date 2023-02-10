import { Type } from "@sinclair/typebox";

import { FastifyValidationSchema } from "../../loaders/fastify";

export const postUploadVehiclePhotoSchema = {
    params: Type.Object({
        uuid: Type.String({ format: "uuid" }),
    }),
    response: {
        201: Type.Object({
            uuid: Type.String({ format: "uuid" }),
            url: Type.String({ format: "uri" }),
            position: Type.Integer(),
        }),
    },
} satisfies FastifyValidationSchema;

export const patchUpdateVehiclePhotoPositionSchema = {
    body: Type.Object({
        position: Type.Integer({ minimum: 0 }),
    }),
    params: Type.Object({
        vehicleUuid: Type.String({ format: "uuid" }),
        photoUuid: Type.String({ format: "uuid" }),
    }),
    response: {
        200: Type.Object({
            uuid: Type.String({ format: "uuid" }),
            url: Type.String({ format: "uri" }),
            position: Type.Integer(),
        }),
    },
} satisfies FastifyValidationSchema;

export const deleteVehiclePhotoSchema = {
    params: Type.Object({
        vehicleUuid: Type.String({ format: "uuid" }),
        photoUuid: Type.String({ format: "uuid" }),
    }),
    response: {
        204: Type.Null(),
    },
} satisfies FastifyValidationSchema;
