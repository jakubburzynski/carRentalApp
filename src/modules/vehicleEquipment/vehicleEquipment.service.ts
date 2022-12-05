import { VehicleEquipment } from "@prisma/client";

import { prisma } from "../../loaders/prisma";
import { ProcessingException } from "../../utils/processingException.util";
import { findVehicleByUuid } from "../vehicle/vehicle.service";

export async function createVehicleEquipment(
    equipment: Pick<VehicleEquipment, "name"> & { vehicleUuid: string },
) {
    const vehicle = await findVehicleByUuid(equipment.vehicleUuid);
    if (!vehicle) {
        throw new ProcessingException(409, "Invalid vehicle uuid");
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
