import argon2 from "argon2";
import { RentalManager } from "@prisma/client";

import { prisma } from "../../loaders/prisma";

export async function registerRentalManager(
    rentalManager: Pick<
        RentalManager,
        "name" | "email" | "password" | "rentalId"
    >,
) {
    const { name, email, password, rentalId } = rentalManager;
    const hashedPassword = await argon2.hash(password);
    return prisma.rentalManager.create({
        data: {
            name,
            email,
            password: hashedPassword,
            rentalId,
        },
    });
}

export async function countRentalManagers() {
    return prisma.rentalManager.count();
}
