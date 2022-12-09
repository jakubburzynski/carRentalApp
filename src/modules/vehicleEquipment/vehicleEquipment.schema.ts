import { Static, Type } from "@sinclair/typebox";

export const postCreateVehicleEquipmentBody = Type.Object({
    name: Type.String({ minLength: 2 }),
});

export type PostCreateVehicleEquipmentBody = Static<
    typeof postCreateVehicleEquipmentBody
>;

export const postCreateVehicleEquipmentParams = Type.Object({
    uuid: Type.String({ format: "uuid" }),
});

export type PostCreateVehicleEquipmentParams = Static<
    typeof postCreateVehicleEquipmentParams
>;

export const postCreateVehicleEquipmentResponse = Type.Object({
    uuid: Type.String({ format: "uuid" }),
    name: Type.String(),
});

export type PostCreateVehicleEquipmentResponse = Static<
    typeof postCreateVehicleEquipmentResponse
>;

export const deleteVehicleEquipmentParams = Type.Object({
    vehicleUuid: Type.String({ format: "uuid" }),
    equipmentUuid: Type.String({ format: "uuid" }),
});

export type DeleteVehicleEquipmentParams = Static<
    typeof deleteVehicleEquipmentParams
>;

export const deleteVehicleEquipmentResponse = Type.Null();

export type DeleteVehicleEquipmentResponse = Static<
    typeof deleteVehicleEquipmentResponse
>;
