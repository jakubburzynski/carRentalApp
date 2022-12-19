import { PrismaClient } from "@prisma/client";

const cleanupDatabase = async (prisma: PrismaClient) => {
    await prisma.customer.deleteMany();
    await prisma.rent.deleteMany();
    await prisma.vehicleService.deleteMany();
    await prisma.vehiclePhoto.deleteMany();
    await prisma.vehicleEquipment.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.rentalManager.deleteMany();
    await prisma.rental.deleteMany();

    await prisma.$disconnect();
};

export default cleanupDatabase;
