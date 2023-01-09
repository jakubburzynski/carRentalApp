import { Static, Type } from "@sinclair/typebox";

export const postUploadVehiclePhotoParams = Type.Object({
    uuid: Type.String({ format: "uuid" }),
});

export type PostUploadVehiclePhotoParams = Static<
    typeof postUploadVehiclePhotoParams
>;

export const postUploadVehiclePhotoResponse = Type.Object({
    uuid: Type.String({ format: "uuid" }),
    url: Type.String({ format: "uri" }),
    position: Type.Integer(),
});

export const patchUpdateVehiclePhotoPositionBody = Type.Tuple([
    Type.Object({
        op: Type.Literal("replace"),
        path: Type.Literal("/position"),
        value: Type.Integer({ minimum: 0 }),
    }),
]);

export type PatchUpdateVehiclePhotoPositionBody = Static<
    typeof patchUpdateVehiclePhotoPositionBody
>;

export const patchUpdateVehiclePhotoPositionParams = Type.Object({
    vehicleUuid: Type.String({ format: "uuid" }),
    photoUuid: Type.String({ format: "uuid" }),
});

export type PatchUpdateVehiclePhotoPositionParams = Static<
    typeof patchUpdateVehiclePhotoPositionParams
>;

export const patchUpdateVehiclePhotoPositionResponse = Type.Object({
    uuid: Type.String({ format: "uuid" }),
    url: Type.String({ format: "uri" }),
    position: Type.Integer(),
});

export const deleteVehiclePhotoParams = Type.Object({
    vehicleUuid: Type.String({ format: "uuid" }),
    photoUuid: Type.String({ format: "uuid" }),
});

export type DeleteVehiclePhotoParams = Static<typeof deleteVehiclePhotoParams>;

export const deleteVehiclePhotoResponse = Type.Null();
