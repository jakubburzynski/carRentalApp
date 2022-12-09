import {
    test,
    describe,
    expect,
    beforeAll,
    beforeEach,
    afterAll,
    afterEach,
} from "@jest/globals";
import { faker } from "@faker-js/faker";
import {
    FuelType,
    Rental,
    RentalManager,
    Vehicle,
    VehicleEquipment,
} from "@prisma/client";
import argon2 from "argon2";

import cleanupDatabase from "../../../test/utils/cleanupDatabase";
import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";

describe("POST /api/v1/vehicles/:uuid/equipment", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let secondRental: Rental;
    let rentalManager: RentalManager;
    let secondRentalManager: RentalManager;
    let fuelTypes: FuelType[];
    let vehicle: Vehicle;
    let sessionId: string;
    let secondSessionId: string;

    const examplePassword = "Q2Fz Zj{d";

    beforeAll(async () => {
        app = await createFastifyServer();
        await cleanupDatabase(app.prisma);
        const unitType = await app.prisma.unitType.findFirstOrThrow();
        rental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitType: {
                    connect: {
                        id: unitType.id,
                    },
                },
            },
        });
        secondRental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitType: {
                    connect: {
                        id: unitType.id,
                    },
                },
            },
        });
        rentalManager = await app.prisma.rentalManager.create({
            data: {
                name: faker.name.firstName(),
                email: faker.internet.email(),
                password: await argon2.hash(examplePassword),
                active: true,
                activationToken: null,
                activationTokenExpiration: null,
                rental: {
                    connect: {
                        id: rental.id,
                    },
                },
            },
        });
        secondRentalManager = await app.prisma.rentalManager.create({
            data: {
                name: faker.name.firstName(),
                email: faker.internet.email(),
                password: await argon2.hash(examplePassword),
                active: true,
                activationToken: null,
                activationTokenExpiration: null,
                rental: {
                    connect: {
                        id: secondRental.id,
                    },
                },
            },
        });
        fuelTypes = await app.prisma.fuelType.findMany();
        vehicle = await app.prisma.vehicle.create({
            data: {
                brand: faker.vehicle.manufacturer(),
                model: faker.vehicle.model(),
                year: faker.datatype.number({ min: 1900, max: 2023 }),
                licensePlate: faker.vehicle.vrm(),
                mileage: faker.datatype.number({ min: 1, max: 1000000 }),
                pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
                description: faker.lorem.paragraph(),
                rental: {
                    connect: {
                        id: rental.id,
                    },
                },
                fuelType: {
                    connect: {
                        id: fuelTypes[0].id,
                    },
                },
            },
        });
        const loginResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: rentalManager.email,
                password: examplePassword,
            },
        });
        sessionId = (
            loginResponse.cookies[0] as { name: string; value: string }
        ).value;
        const secondLoginResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: secondRentalManager.email,
                password: examplePassword,
            },
        });
        secondSessionId = (
            secondLoginResponse.cookies[0] as { name: string; value: string }
        ).value;
    });

    afterEach(async () => {
        await app.prisma.vehicleEquipment.deleteMany();
    });

    afterAll(async () => {
        await cleanupDatabase(app.prisma);
        await app.close();
    });

    test("should create a vehicle equipment", async () => {
        const payload = {
            name: faker.commerce.product(),
        };
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/equipment`,
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: payload.name,
        });
        expect(vehicleEquipment.length).toBe(1);
        expect(vehicleEquipment[0].vehicleId).toBe(vehicle.id);
    });

    test("should not create a vehicle equipment with not existing vehicle", async () => {
        const payload = {
            name: faker.commerce.product(),
        };
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${faker.datatype.uuid()}/equipment`,
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid vehicle uuid");
        expect(vehicleEquipment.length).toBe(0);
    });

    test("should not create a vehicle equipment if rental manager is not logged in", async () => {
        const payload = {
            name: faker.commerce.product(),
        };
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/equipment`,
            payload,
            cookies: undefined,
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(401);
        expect(response.json().message).toEqual("Not authenticated");
        expect(vehicleEquipment.length).toBe(0);
    });

    test("should check if currently logged in rental manager has rights to create equipment", async () => {
        const payload = {
            name: faker.commerce.product(),
        };
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/equipment`,
            payload,
            cookies: {
                sessionId: secondSessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(403);
        expect(response.json().message).toEqual(
            "Not authorized to maintain this vehicle",
        );
        expect(vehicleEquipment.length).toBe(0);
    });

    test("should check if equipment name is at least 2 character long", async () => {
        const payload = {
            name: "a",
        };
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/equipment`,
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body/name must NOT have fewer than 2 characters",
        );
        expect(vehicleEquipment.length).toBe(0);
    });

    test("should check if vehicle uuid is a valid uuid", async () => {
        const payload = {
            name: faker.commerce.product(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles/123/equipment",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/uuid must match format "uuid"',
        );
        expect(vehicleEquipment.length).toBe(0);
    });
});

describe("DELETE /api/v1/vehicles/:vehicleUuid/equipment/:equipmentUuid", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let rentalManager: RentalManager;
    let sessionId: string;
    let secondRental: Rental;
    let secondRentalManager: RentalManager;
    let secondSessionId: string;
    let fuelTypes: FuelType[];
    let vehicle: Vehicle;
    let equipment: VehicleEquipment;

    const examplePassword = "Q2Fz Zj{d";

    beforeEach(async () => {
        equipment = await app.prisma.vehicleEquipment.create({
            data: {
                name: faker.commerce.product(),
                vehicle: {
                    connect: {
                        id: vehicle.id,
                    },
                },
            },
        });
    });

    beforeAll(async () => {
        app = await createFastifyServer();
        await cleanupDatabase(app.prisma);
        const unitType = await app.prisma.unitType.findFirstOrThrow();
        rental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitType: {
                    connect: {
                        id: unitType.id,
                    },
                },
            },
        });
        rentalManager = await app.prisma.rentalManager.create({
            data: {
                name: faker.name.firstName(),
                email: faker.internet.email(),
                password: await argon2.hash(examplePassword),
                active: true,
                activationToken: null,
                activationTokenExpiration: null,
                rental: {
                    connect: {
                        id: rental.id,
                    },
                },
            },
        });
        secondRental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitType: {
                    connect: {
                        id: unitType.id,
                    },
                },
            },
        });
        secondRentalManager = await app.prisma.rentalManager.create({
            data: {
                name: faker.name.firstName(),
                email: faker.internet.email(),
                password: await argon2.hash(examplePassword),
                active: true,
                activationToken: null,
                activationTokenExpiration: null,
                rental: {
                    connect: {
                        id: secondRental.id,
                    },
                },
            },
        });
        fuelTypes = await app.prisma.fuelType.findMany();
        vehicle = await app.prisma.vehicle.create({
            data: {
                brand: faker.vehicle.manufacturer(),
                model: faker.vehicle.model(),
                year: faker.datatype.number({ min: 1900, max: 2023 }),
                licensePlate: faker.vehicle.vrm(),
                mileage: faker.datatype.number({ min: 1, max: 1000000 }),
                pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
                description: faker.lorem.paragraph(),
                rental: {
                    connect: {
                        id: rental.id,
                    },
                },
                fuelType: {
                    connect: {
                        id: fuelTypes[0].id,
                    },
                },
            },
        });
        const loginResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: rentalManager.email,
                password: examplePassword,
            },
            cookies: undefined,
        });
        sessionId = (
            loginResponse.cookies[0] as { name: string; value: string }
        ).value;
        const secondLoginResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: secondRentalManager.email,
                password: examplePassword,
            },
            cookies: undefined,
        });
        secondSessionId = (
            secondLoginResponse.cookies[0] as { name: string; value: string }
        ).value;
    });

    afterEach(async () => {
        await app.prisma.vehicleEquipment.deleteMany();
    });

    afterAll(async () => {
        await cleanupDatabase(app.prisma);
        await app.close();
    });

    test("should delete a specific equipment from vehicle", async () => {
        let vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(vehicleEquipment.length).toBe(1);

        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/equipment/${equipment.uuid}`,
            cookies: {
                sessionId,
            },
        });

        vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(204);
        expect(response.body).toEqual("");
        expect(vehicleEquipment.length).toBe(0);
    });

    test("should check for not existing equipment", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${
                vehicle.uuid
            }/equipment/${faker.datatype.uuid()}`,
            cookies: {
                sessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid equipment uuid");
        expect(vehicleEquipment.length).toBe(1);
    });

    test("should check for not existing vehicle", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${faker.datatype.uuid()}/equipment/${
                equipment.uuid
            }`,
            cookies: {
                sessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid vehicle uuid");
        expect(vehicleEquipment.length).toBe(1);
    });

    test("should not delete a vehicle equipment if rental manager is not logged in", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/equipment/${equipment.uuid}`,
            cookies: undefined,
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(401);
        expect(response.json().message).toEqual("Not authenticated");
        expect(vehicleEquipment.length).toBe(1);
    });

    test("should check if currently logged rental manager has rights to delete equipment", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/equipment/${equipment.uuid}`,
            cookies: {
                sessionId: secondSessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(403);
        expect(response.json().message).toEqual(
            "Not authorized to maintain this vehicle",
        );
        expect(vehicleEquipment.length).toBe(1);
    });

    test("should check if equipmentUuid is a valid uuid", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/equipment/123`,
            cookies: {
                sessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/equipmentUuid must match format "uuid"',
        );
        expect(vehicleEquipment.length).toBe(1);
    });

    test("should check if vehicleUuid is a valid uuid", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/123/equipment/${equipment.uuid}`,
            cookies: {
                sessionId,
            },
        });

        const vehicleEquipment = await app.prisma.vehicleEquipment.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/vehicleUuid must match format "uuid"',
        );
        expect(vehicleEquipment.length).toBe(1);
    });
});
