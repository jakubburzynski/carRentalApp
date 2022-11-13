import { prisma } from "../../loaders/prisma";

export async function findFuelTypeByUuid(uuid: string) {
    return prisma.fuelType.findUnique({
        where: { uuid },
    });
}
