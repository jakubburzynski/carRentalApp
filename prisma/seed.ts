import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    await prisma.unitType.createMany({
        data: [{ name: "Metric" }, { name: "Imperial" }],
    });

    await prisma.fuelType.createMany({
        data: [
            { name: "Gas" },
            { name: "Diesel" },
            { name: "Electric" },
            { name: "Hybrid" },
        ],
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
