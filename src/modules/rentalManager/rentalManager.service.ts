import argon2 from "argon2";
import { RentalManager } from "@prisma/client";

import { prisma } from "../../loaders/prisma";
import generateRandomToken from "../../utils/randomToken.util";
import mailingService from "../../loaders/mail";

export async function registerRentalManager(
    rentalManager: Pick<
        RentalManager,
        "name" | "email" | "password" | "rentalId"
    >,
) {
    const { name, email, password, rentalId } = rentalManager;
    const hashedPassword = await argon2.hash(password);
    const createdRentalManager = await prisma.rentalManager.create({
        data: {
            name,
            email,
            password: hashedPassword,
            activationToken: generateRandomToken(32),
            activationTokenExpiration: new Date(
                Date.now() + 1000 * 60 * 60 * 24,
            ),
            rentalId,
        },
    });
    await mailingService.send({
        to: createdRentalManager.email,
        subject: "Rental manager account verifictation",
        text: `Hi, ${createdRentalManager.name}! Activation token: ${createdRentalManager.activationToken}, expires in 24 hours.`,
        html: `Hi, ${createdRentalManager.name}! Activation token: ${createdRentalManager.activationToken}, expires in 24 hours.`,
    });
    return createdRentalManager;
}

export async function countRentalManagers() {
    return prisma.rentalManager.count();
}
