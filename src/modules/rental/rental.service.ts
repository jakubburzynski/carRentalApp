import { Rental } from "@prisma/client";
import { prisma } from "../../loaders/prisma";

export async function createRental(
    rental: Pick<Rental, "name" | "unitTypeId">,
) {
    return prisma.rental.create({
        data: {
            name: rental.name,
            unitType: {
                connect: { id: rental.unitTypeId },
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
