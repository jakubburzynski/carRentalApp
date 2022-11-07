import { Rental } from "@prisma/client";

import { prisma } from "../../loaders/prisma";
import { ProcessingException } from "../../utils/processingException.util";
import { findUnitTypeByUuid } from "../unitType/unitType.service";

export async function createRental(
    rental: Pick<Rental, "name"> & { unitTypeUuid: string },
) {
    const rentalCount = await countRentals();
    if (rentalCount >= 1) {
        throw new ProcessingException(
            409,
            "It is not possible to create more than one rental",
        );
    }

    const unitType = await findUnitTypeByUuid(rental.unitTypeUuid);
    if (!unitType) {
        throw new ProcessingException(409, "Invalid unit type uuid");
    }

    return prisma.rental.create({
        data: {
            name: rental.name,
            unitType: {
                connect: { id: unitType.id },
            },
        },
    });
}

export async function countRentals() {
    return prisma.rental.count();
}

export async function findRentalByUuid(uuid: string) {
    return prisma.rental.findUnique({
        where: { uuid },
    });
}
