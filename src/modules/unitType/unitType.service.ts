import { prisma } from "../../loaders/prisma";

export async function findUnitTypeByUuid(uuid: string) {
    return prisma.unitType.findUnique({
        where: {
            uuid,
        },
    });
}

export async function findAllUnitTypes() {
    return prisma.unitType.findMany();
}
