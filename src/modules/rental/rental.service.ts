import { prisma } from "../../loaders/prisma";
import { PostCreateRentalBody } from "./rental.schema";

export async function createRental(rental: PostCreateRentalBody) {
    return prisma.rental.create({
        data: rental,
    });
}

export async function countRentals() {
    return prisma.rental.count();
}
