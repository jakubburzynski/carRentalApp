import argon2 from "argon2";
import { RentalManager } from "@prisma/client";

import { prisma } from "../../loaders/prisma";
import generateRandomToken from "../../utils/randomToken.util";
import { mailingService } from "../../loaders/mail";
import { ProcessingException } from "../../utils/processingException.util";
import { findRentalByUuid } from "../rental/rental.service";

export async function registerRentalManager(
    rentalManager: Pick<RentalManager, "name" | "email" | "password"> & {
        rentalUuid: string;
    },
) {
    const rentalManagerCount = await countRentalManagers();
    if (rentalManagerCount >= 1) {
        throw new ProcessingException(
            409,
            "It is not possible to register more than one rental manager",
        );
    }

    const rental = await findRentalByUuid(rentalManager.rentalUuid);
    if (!rental) {
        throw new ProcessingException(409, "Invalid rental uuid");
    }

    const { name, email, password } = rentalManager;
    const hashedPassword = await argon2.hash(password);
    const createdRentalManager = await prisma.rentalManager.create({
        data: {
            name,
            email,
            password: hashedPassword,
            activationToken: await generateRandomToken(32),
            activationTokenExpiration: new Date(
                Date.now() + 1000 * 60 * 60 * 24,
            ),
            rental: {
                connect: { id: rental.id },
            },
        },
        include: {
            rental: true,
        },
    });
    await mailingService.send({
        to: createdRentalManager.email,
        subject: `[${createdRentalManager.rental.name}] Rental manager account verifictation`,
        text: `Hi, ${createdRentalManager.name}! Activation token: '${createdRentalManager.activationToken}', expires in 24 hours.`,
        html: `Hi, ${createdRentalManager.name}! Activation token: '${createdRentalManager.activationToken}', expires in 24 hours.`,
    });
    return createdRentalManager;
}

export async function activateRentalManager(uuid: string, token: string) {
    const rentalManager = await prisma.rentalManager.findUnique({
        where: { uuid },
    });

    if (!rentalManager) {
        throw new ProcessingException(404, "Rental manager not found");
    }
    if (
        rentalManager.active ||
        !rentalManager.activationToken ||
        !rentalManager.activationTokenExpiration
    ) {
        throw new ProcessingException(409, "Rental manager already activated");
    }
    if (rentalManager.activationToken !== token) {
        throw new ProcessingException(409, "Invalid activation token");
    }
    if (new Date() > rentalManager.activationTokenExpiration) {
        throw new ProcessingException(409, "Activation token expired");
    }

    const activatedRentalManager = await prisma.rentalManager.update({
        where: { uuid },
        data: {
            active: true,
            activationToken: null,
            activationTokenExpiration: null,
        },
        include: {
            rental: true,
        },
    });
    await mailingService.send({
        to: activatedRentalManager.email,
        subject: `[${activatedRentalManager.rental.name}] Rental manager account activated`,
        text: `Hi, ${activatedRentalManager.name}! Your account has been activated. You can now log in to your account.`,
        html: `Hi, ${activatedRentalManager.name}! Your account has been activated. You can now log in to your account.`,
    });

    return activatedRentalManager;
}

export async function findRentalManagerByLoginCredentials(
    email: string,
    password: string,
) {
    const rentalManager = await prisma.rentalManager.findUnique({
        where: { email },
        include: {
            rental: true,
        },
    });

    if (!rentalManager) {
        throw new ProcessingException(404, "Rental manager not found");
    }

    if (!(await argon2.verify(rentalManager.password, password))) {
        throw new ProcessingException(404, "Rental manager not found");
    }

    return rentalManager;
}

export async function countRentalManagers() {
    return prisma.rentalManager.count();
}
