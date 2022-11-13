import {
    test,
    describe,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from "@jest/globals";
import { faker } from "@faker-js/faker";
import { FuelType, Rental, RentalManager } from "@prisma/client";
import argon2 from "argon2";

import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";

describe("POST /api/v1/vehicles", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let rentalManager: RentalManager;
    let fuelTypes: FuelType[];
    let sessionId: string;

    const examplePassword = "Q2Fz Zj{d";

    beforeAll(async () => {
        app = await createFastifyServer();
        await app.prisma.rentalManager.deleteMany();
        await app.prisma.vehicle.deleteMany();
        await app.prisma.rental.deleteMany();
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
        fuelTypes = await app.prisma.fuelType.findMany();
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
    });

    afterEach(async () => {
        await app.prisma.vehicle.deleteMany();
    });

    afterAll(async () => {
        await app.prisma.vehicle.deleteMany();
        await app.close();
    });

    test("should create a vehicle with auto-generated name", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: `${payload.brand} ${payload.model} ${payload.year}`,
        });
        expect(vehicles.length).toBe(1);
        expect(vehicles[0].name).toBe(null);
        expect(vehicles[0].fuelTypeId).toBe(fuelTypes[0].id);
        expect(vehicles[0].rentalId).toBe(rental.id);
    });

    test("should create a vehicle with passed name", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            name: "The best car ever",
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: payload.name,
        });
        expect(vehicles.length).toBe(1);
        expect(vehicles[0].name).toBe(payload.name);
        expect(vehicles[0].fuelTypeId).toBe(fuelTypes[0].id);
        expect(vehicles[0].rentalId).toBe(rental.id);
    });

    test("should not create a vehicle if rental manager is not logged in", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: undefined,
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(401);
        expect(response.json().message).toEqual("Not authenticated");
        expect(vehicles.length).toBe(0);
    });

    test("should not create a vehicle with not existing fuel type", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: faker.datatype.uuid(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid fuel type uuid");
        expect(vehicles.length).toBe(0);
    });

    test("should not create a vehicle with not existing rental", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: faker.datatype.uuid(),
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid rental uuid");
        expect(vehicles.length).toBe(0);
    });

    test("should check for a missing brand", async () => {
        const payload = {
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'brand'",
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check for a missing model", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'model'",
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check for a missing year", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'year'",
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check for a year that is not in the range 1900 <-> currentYear+1", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: new Date().getFullYear() + 2,
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            `body/year must be <= ${new Date().getFullYear() + 1}`,
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check for a missing mileage", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'mileage'",
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check for a mileage that is smaller than 0", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: -1000000, max: -1 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("body/mileage must be >= 1");
        expect(vehicles.length).toBe(0);
    });

    test("should check for a missing pricePerDay", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'pricePerDay'",
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check for a pricePerDay that is not positive", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: 0,
            rentalUuid: rental.uuid,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body/pricePerDay must be >= 1",
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check for a missing rentalUuid", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'rentalUuid'",
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check if rentalUuid is a valid uuid", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: 123,
            fuelTypeUuid: fuelTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/rentalUuid must match format "uuid"',
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check for a missing fuelTypeUuid", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'fuelTypeUuid'",
        );
        expect(vehicles.length).toBe(0);
    });

    test("should check if fuelTypeUuid is a valid uuid", async () => {
        const payload = {
            brand: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            year: faker.datatype.number({ min: 1900, max: 2023 }),
            description: faker.lorem.paragraph(),
            mileage: faker.datatype.number({ min: 1, max: 1000000 }),
            licensePlate: faker.vehicle.vrm(),
            pricePerDay: faker.datatype.number({ min: 1, max: 15000 }),
            rentalUuid: rental.uuid,
            fuelTypeUuid: 123,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/vehicles",
            payload,
            cookies: {
                sessionId,
            },
        });

        const vehicles = await app.prisma.vehicle.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/fuelTypeUuid must match format "uuid"',
        );
        expect(vehicles.length).toBe(0);
    });
});
