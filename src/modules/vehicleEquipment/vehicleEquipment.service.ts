import { VehicleEquipment } from "@prisma/client";

import { prisma } from "../../loaders/prisma";
import { ProcessingException } from "../../utils/processingException.util";
import { findVehicleByUuid } from "../vehicle/vehicle.service";

export async function createVehicleEquipment(
    equipment: Pick<VehicleEquipment, "name"> & {
        vehicleUuid: string;
        rentalUuid: string;
    },
) {
    const vehicle = await findVehicleByUuid(equipment.vehicleUuid, true);
    if (!vehicle) {
        throw new ProcessingException(409, "Invalid vehicle uuid");
    }
    if (vehicle.rental.uuid !== equipment.rentalUuid) {
        throw new ProcessingException(
            403,
            "Not authorized to maintain this vehicle",
        );
    }

    return prisma.vehicleEquipment.create({
        data: {
            name: equipment.name,
            vehicle: {
                connect: {
                    id: vehicle.id,
                },
            },
        },
    });
}

export async function updateVehicleEquipmentName(updateData: {
    rentalUuid: string;
    vehicleUuid: string;
    equipmentUuid: string;
    name: string;
}) {
    const equipment = await prisma.vehicleEquipment.findUnique({
        where: {
            uuid: updateData.equipmentUuid,
        },
        include: {
            vehicle: {
                include: {
                    rental: true,
                },
            },
        },
    });
    if (!equipment) {
        throw new ProcessingException(409, "Invalid equipment uuid");
    }
    if (equipment.vehicle.uuid !== updateData.vehicleUuid) {
        throw new ProcessingException(409, "Invalid vehicle uuid");
    }
    if (equipment.vehicle.rental.uuid !== updateData.rentalUuid) {
        throw new ProcessingException(
            403,
            "Not authorized to maintain this vehicle",
        );
    }

    return prisma.vehicleEquipment.update({
        where: {
            uuid: updateData.equipmentUuid,
        },
        data: {
            name: updateData.name,
        },
    });
}

export async function deleteVehicleEquipment(deletionData: {
    rentalUuid: string;
    vehicleUuid: string;
    equipmentUuid: string;
}) {
    const equipment = await prisma.vehicleEquipment.findUnique({
        where: {
            uuid: deletionData.equipmentUuid,
        },
        include: {
            vehicle: {
                include: {
                    rental: true,
                },
            },
        },
    });
    if (!equipment) {
        throw new ProcessingException(409, "Invalid equipment uuid");
    }
    if (equipment.vehicle.uuid !== deletionData.vehicleUuid) {
        throw new ProcessingException(409, "Invalid vehicle uuid");
    }
    if (equipment.vehicle.rental.uuid !== deletionData.rentalUuid) {
        throw new ProcessingException(
            403,
            "Not authorized to maintain this vehicle",
        );
    }

    const deleteOperation = await prisma.vehicleEquipment.delete({
        where: {
            uuid: deletionData.equipmentUuid,
        },
    });
    return deleteOperation;
}
