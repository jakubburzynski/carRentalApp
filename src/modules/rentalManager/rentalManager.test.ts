import {
    test,
    describe,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from "@jest/globals";
import { faker } from "@faker-js/faker";
import { Rental } from "@prisma/client";
import sinon from "sinon";
import argon2 from "argon2";

import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";
import passwordRegex from "../../utils/passwordRegex.util";
import mailingService from "../../loaders/mail";
import generateRandomToken from "../../utils/randomToken.util";

describe("POST /api/v1/rental-managers", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    const argon2HashSpy = sinon.spy(argon2, "hash");
    const randomTokenSpy = sinon.spy(generateRandomToken);
    const mailSendMock = sinon.stub(mailingService, "send").resolves();
    const examplePassword = "Q2Fz Zj{d";
    beforeAll(async () => {
        app = await createFastifyServer();
        await app.prisma.rental.deleteMany();
        await app.prisma.rentalManager.deleteMany();
        const unitType = await app.prisma.unitType.findFirstOrThrow();
        rental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitTypeId: unitType.id,
            },
        });
    });

    afterEach(async () => {
        await app.prisma.rentalManager.deleteMany();
        argon2HashSpy.resetHistory();
        randomTokenSpy.resetHistory();
        mailSendMock.resetHistory();
    });

    afterAll(async () => {
        await app.prisma.rentalManager.deleteMany();
        argon2HashSpy.restore();
        randomTokenSpy.restore();
        mailSendMock.restore();
        await app.close();
    });

    test("make sure example password matches regex", () => {
        expect(examplePassword).toMatch(passwordRegex);
    });

    test("should create a rental manager", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: payload.name,
            email: payload.email,
        });
        expect(argon2HashSpy.calledOnceWithExactly(payload.password)).toBe(
            true,
        );
        expect(rentalManagers[0].password).toEqual(
            await argon2HashSpy.returnValues[0],
        );
        expect(
            mailSendMock.calledOnceWithExactly({
                to: payload.email,
                subject: "Rental manager account verifictation",
                text: `Hi, ${payload.name}! Activation token: ${randomTokenSpy.returnValues[0]}, expires in 24 hours.`,
                html: `Hi, ${payload.name}! Activation token: ${randomTokenSpy.returnValues[0]}, expires in 24 hours.`,
            }),
        ).toBe(true);
        expect(rentalManagers.length).toBe(1);
        expect(rentalManagers[0].active).toBe(false);
        expect(randomTokenSpy.calledOnceWithExactly(32)).toBe(true);
        expect(rentalManagers[0].activationToken).toEqual(
            randomTokenSpy.returnValues[0],
        );
    });

    test("should not create a rental manager with not existing rental uuid", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: faker.datatype.uuid(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid rental uuid");
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should not create more than one rental manager", async () => {
        const firstPayload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const firstResponse = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload: firstPayload,
        });

        const secondPayload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const secondResponse = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload: secondPayload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(firstResponse.statusCode).toBe(201);
        expect(firstResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: firstPayload.name,
            email: firstPayload.email,
        });
        expect(argon2HashSpy.calledOnceWithExactly(firstPayload.password)).toBe(
            true,
        );
        expect(rentalManagers.length).toBe(1);
        expect(rentalManagers[0].password).toEqual(
            await argon2HashSpy.returnValues[0],
        );
        expect(secondResponse.statusCode).toBe(409);
        expect(secondResponse.json().message).toEqual(
            "It is not possible to register more than one rental manager",
        );
    });

    test("should check if name is at least 3 characters long", async () => {
        const payload = {
            name: "ab",
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body/name must NOT have fewer than 3 characters",
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check for invalid email", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: "invalidemail@",
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/email must match format "email"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password is at least 8 characters", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "Aa1!Aa1",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password has at least one small letter", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "AA1!AA1!",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password has at least one capital letter", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "aa1!aa1!",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password has at least one number", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "Aa!!Aa!!",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password has at least one special character", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "Aa11Aa11",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if rentalUuid is a valid uuid", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: 123,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/rentalUuid must match format "uuid"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });
});
