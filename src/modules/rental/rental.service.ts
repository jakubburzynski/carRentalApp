import { Rental } from "@prisma/client";
import { prisma } from "../../loaders/prisma";

export async function createRental(
    rental: Pick<Rental, "name" | "unitTypeId">,
) {
    return prisma.rental.create({
        data: rental,
    });
}

export async function countRentals() {
    return prisma.rental.count();
}
