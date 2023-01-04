import { prisma } from "../../loaders/prisma";

export async function findAllFuelTypes() {
    return prisma.fuelType.findMany();
}

export async function findFuelTypeByUuid(uuid: string) {
    return prisma.fuelType.findUnique({
        where: { uuid },
    });
}
