import { Vehicle } from "@prisma/client";

import { prisma } from "../../loaders/prisma";
import { ProcessingException } from "../../utils/processingException.util";
import { findFuelTypeByUuid } from "../fuelType/fuelType.service";
import { findRentalByUuid } from "../rental/rental.service";

type VehicleWithRequiredName = Vehicle & { name: string };

const buildVehicleName = (vehicle: Vehicle): string =>
    `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
const isVehicleNameString = (
    vehicle: Vehicle,
): vehicle is VehicleWithRequiredName => typeof vehicle.name === "string";

function assureVehicleHasName(vehicle: Vehicle): VehicleWithRequiredName {
    if (isVehicleNameString(vehicle)) {
        return vehicle;
    }

    return {
        ...vehicle,
        name: buildVehicleName(vehicle),
    };
}

export async function createVehicle(
    vehicle: Pick<
        Vehicle,
        | "brand"
        | "model"
        | "year"
        | "description"
        | "mileage"
        | "licensePlate"
        | "pricePerDay"
        | "name"
    > & {
        rentalUuid: string;
        fuelTypeUuid: string;
    },
): Promise<VehicleWithRequiredName> {
    const rental = await findRentalByUuid(vehicle.rentalUuid);
    if (!rental) {
        throw new ProcessingException(409, "Invalid rental uuid");
    }

    const fuelType = await findFuelTypeByUuid(vehicle.fuelTypeUuid);
    if (!fuelType) {
        throw new ProcessingException(409, "Invalid fuel type uuid");
    }

    const createdVehicle = await prisma.vehicle.create({
        data: {
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            description: vehicle.description,
            mileage: vehicle.mileage,
            licensePlate: vehicle.licensePlate,
            pricePerDay: vehicle.pricePerDay,
            name: vehicle.name,
            fuelType: {
                connect: { id: fuelType.id },
            },
            rental: {
                connect: { id: rental.id },
            },
        },
    });

    return assureVehicleHasName(createdVehicle);
}
