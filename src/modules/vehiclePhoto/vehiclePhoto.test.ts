import {
    test,
    describe,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from "@jest/globals";
import { faker } from "@faker-js/faker";
import { FuelType, Rental, RentalManager, Vehicle } from "@prisma/client";
import argon2 from "argon2";
import FormData from "form-data";
import path from "node:path";
import sinon, { SinonSpiedMember, SinonStubbedMember } from "sinon";
import crypto from "node:crypto";
import { createReadStream, ReadStream } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import cleanupDatabase from "../../../test/utils/cleanupDatabase";
import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";

describe("POST /api/v1/vehicles/:uuid/photos", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let secondRental: Rental;
    let rentalManager: RentalManager;
    let secondRentalManager: RentalManager;
    let fuelTypes: FuelType[];
    let vehicle: Vehicle;
    let secondVehicle: Vehicle;
    let s3SendStub: SinonStubbedMember<typeof S3Client.prototype.send>;
    let cryptoRandomUUIDSpy: SinonSpiedMember<typeof crypto.randomUUID>;
    let sessionId: string;
    let secondSessionId: string;
    let s3BucketBaseUrl: string;

    const loadPhotoFromAssets = (fileName: string): ReadStream => {
        return createReadStream(path.join(photosPath, fileName));
    };
    const loadPngVehiclePhoto = () => loadPhotoFromAssets("first-vehicle.png");
    const loadJpegVehiclePhoto = () =>
        loadPhotoFromAssets("second-vehicle.jpg");
    const loadGifVehiclePhoto = () => loadPhotoFromAssets("wrong-mimetype.gif");
    const loadTooBigVehiclePhoto = () => loadPhotoFromAssets("too-big.jpg");
    const examplePassword = "Q2Fz Zj{d";
    const photosPath = path.join(__dirname, "..", "..", "..", "test", "assets");

    beforeAll(async () => {
        s3SendStub = sinon.stub(S3Client.prototype, "send").resolves({
            $metadata: {
                httpStatusCode: 200,
            },
        });
        cryptoRandomUUIDSpy = sinon.spy(crypto, "randomUUID");
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
        secondVehicle = await app.prisma.vehicle.create({
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
                        id: fuelTypes[1].id,
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
        s3BucketBaseUrl = `https://s3.${app.config.S3_REGION}.amazonaws.com/${app.config.S3_BUCKET_NAME}`;
    });

    afterEach(async () => {
        s3SendStub.resetHistory();
        cryptoRandomUUIDSpy.resetHistory();
        await app.prisma.vehiclePhoto.deleteMany();
    });

    afterAll(async () => {
        s3SendStub.restore();
        cryptoRandomUUIDSpy.restore();
        await cleanupDatabase(app.prisma);
        await app.close();
    });

    test("should upload a png photo", async () => {
        const form = new FormData();
        form.append("photo", loadPngVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[0]}.png`,
            position: 128,
        });
        expect(cryptoRandomUUIDSpy.calledOnce).toBe(true);
        expect(vehiclePhotos.length).toEqual(1);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(128);
        expect(vehiclePhotos[0].vehicleId).toBe(vehicle.id);
        expect(s3SendStub.calledOnce).toBe(true);
        expect(
            (s3SendStub.lastCall.firstArg as PutObjectCommand).input,
        ).toEqual({
            Bucket: app.config.S3_BUCKET_NAME,
            Key: `${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[0]}.png`,
            Body: expect.any(Buffer),
            ContentType: "image/png",
        });
    });

    test("should upload a jpeg photo", async () => {
        const form = new FormData();
        form.append("photo", loadJpegVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[0]}.jpeg`,
            position: 128,
        });
        expect(cryptoRandomUUIDSpy.calledOnce).toBe(true);
        expect(vehiclePhotos.length).toEqual(1);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(128);
        expect(vehiclePhotos[0].vehicleId).toBe(vehicle.id);
        expect(s3SendStub.calledOnce).toBe(true);
        expect(
            (s3SendStub.lastCall.firstArg as PutObjectCommand).input,
        ).toEqual({
            Bucket: app.config.S3_BUCKET_NAME,
            Key: `${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[0]}.jpeg`,
            Body: expect.any(Buffer),
            ContentType: "image/jpeg",
        });
    });

    test("should maintain order when uploading next photos", async () => {
        const firstForm = new FormData();
        firstForm.append("photo", loadJpegVehiclePhoto());
        const firstResponse = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: firstForm,
            headers: firstForm.getHeaders(),
            cookies: {
                sessionId,
            },
        });
        const secondForm = new FormData();
        secondForm.append("photo", loadPngVehiclePhoto());
        const secondResponse = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: secondForm,
            headers: secondForm.getHeaders(),
            cookies: {
                sessionId,
            },
        });
        const thirdForm = new FormData();
        thirdForm.append("photo", loadJpegVehiclePhoto());
        const thirdResponse = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: thirdForm,
            headers: thirdForm.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(firstResponse.statusCode).toBe(201);
        expect(firstResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[0]}.jpeg`,
            position: 128,
        });
        expect(secondResponse.statusCode).toBe(201);
        expect(secondResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[1]}.png`,
            position: 256,
        });
        expect(thirdResponse.statusCode).toBe(201);
        expect(thirdResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[2]}.jpeg`,
            position: 384,
        });
        expect(cryptoRandomUUIDSpy.calledThrice).toBe(true);
        expect(vehiclePhotos.length).toEqual(3);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(128);
        expect(vehiclePhotos[0].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[1].uuid).toBe(cryptoRandomUUIDSpy.returnValues[1]);
        expect(vehiclePhotos[1].position).toBe(256);
        expect(vehiclePhotos[1].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[2].uuid).toBe(cryptoRandomUUIDSpy.returnValues[2]);
        expect(vehiclePhotos[2].position).toBe(384);
        expect(vehiclePhotos[2].vehicleId).toBe(vehicle.id);
        expect(s3SendStub.calledThrice).toBe(true);
    });

    test("should maintain order per vehicle", async () => {
        const firstForm = new FormData();
        firstForm.append("photo", loadJpegVehiclePhoto());
        const firstResponse = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: firstForm,
            headers: firstForm.getHeaders(),
            cookies: {
                sessionId,
            },
        });
        const secondForm = new FormData();
        secondForm.append("photo", loadPngVehiclePhoto());
        const secondResponse = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${secondVehicle.uuid}/photos`,
            payload: secondForm,
            headers: secondForm.getHeaders(),
            cookies: {
                sessionId,
            },
        });
        const thirdForm = new FormData();
        thirdForm.append("photo", loadPngVehiclePhoto());
        const thirdResponse = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: thirdForm,
            headers: thirdForm.getHeaders(),
            cookies: {
                sessionId,
            },
        });
        const fourthForm = new FormData();
        fourthForm.append("photo", loadJpegVehiclePhoto());
        const fourthResponse = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${secondVehicle.uuid}/photos`,
            payload: fourthForm,
            headers: fourthForm.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(firstResponse.statusCode).toBe(201);
        expect(firstResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[0]}.jpeg`,
            position: 128,
        });
        expect(secondResponse.statusCode).toBe(201);
        expect(secondResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${secondVehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[1]}.png`,
            position: 128,
        });
        expect(thirdResponse.statusCode).toBe(201);
        expect(thirdResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[2]}.png`,
            position: 256,
        });
        expect(fourthResponse.statusCode).toBe(201);
        expect(fourthResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${secondVehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[3]}.jpeg`,
            position: 256,
        });
        expect(cryptoRandomUUIDSpy.callCount).toBe(4);
        expect(vehiclePhotos.length).toEqual(4);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(128);
        expect(vehiclePhotos[0].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[1].uuid).toBe(cryptoRandomUUIDSpy.returnValues[1]);
        expect(vehiclePhotos[1].position).toBe(128);
        expect(vehiclePhotos[1].vehicleId).toBe(secondVehicle.id);
        expect(vehiclePhotos[2].uuid).toBe(cryptoRandomUUIDSpy.returnValues[2]);
        expect(vehiclePhotos[2].position).toBe(256);
        expect(vehiclePhotos[2].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[3].uuid).toBe(cryptoRandomUUIDSpy.returnValues[3]);
        expect(vehiclePhotos[3].position).toBe(256);
        expect(vehiclePhotos[3].vehicleId).toBe(secondVehicle.id);
        expect(s3SendStub.callCount).toBe(4);
    });

    test("should not upload a vehicle photo with not existing vehicle", async () => {
        const form = new FormData();
        form.append("photo", loadJpegVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${faker.datatype.uuid()}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid vehicle uuid");
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should not upload a gif photo", async () => {
        const form = new FormData();
        form.append("photo", loadGifVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(415);
        expect(response.json().message).toEqual(
            "Unsupported vehicle photo extension",
        );
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should not upload a photo if rental manager is not logged in", async () => {
        const form = new FormData();
        form.append("photo", loadJpegVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: undefined,
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(401);
        expect(response.json().message).toEqual("Not authenticated");
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should check if currently logged in rental manager has rights to create equipment", async () => {
        const form = new FormData();
        form.append("photo", loadPngVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId: secondSessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(403);
        expect(response.json().message).toEqual(
            "Not authorized to maintain this vehicle",
        );
        expect(vehiclePhotos.length).toEqual(0);
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should check if content type is multipart/form-data", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: {
                photo: Buffer.from(faker.random.words()),
            },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(415);
        expect(response.json().message).toEqual(
            "Request content type is not multipart",
        );
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should only process vehicle photo from 'photo' field", async () => {
        const form = new FormData();
        form.append("otherPhoto", loadJpegVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(422);
        expect(response.json().message).toEqual(
            "Vehicle photo should be attached to the 'photo' field",
        );
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should check for no photo attached", async () => {
        const form = new FormData();

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("No vehicle photo uploaded");
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should not allow files bigger than 2MB", async () => {
        const form = new FormData();
        form.append("photo", loadTooBigVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(413);
        expect(response.json().message).toEqual(
            "Vehicle photo size should not exceed 2MB",
        );
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should not accept text value under 'photo' field", async () => {
        const form = new FormData();
        form.append("photo", "random text");

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "Only allowed field type is photo",
        );
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should check if param uuid is a valid uuid", async () => {
        const form = new FormData();
        form.append("photo", loadPngVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${faker.random.alphaNumeric(24)}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/uuid must match format "uuid"',
        );
        expect(cryptoRandomUUIDSpy.notCalled).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.notCalled).toBe(true);
    });

    // from this place s3SendStub resolves with 500 status code
    test("should revert vehicle photo creation in case of S3 upload error", async () => {
        s3SendStub.restore();
        s3SendStub = sinon.stub(S3Client.prototype, "send").resolves({
            $metadata: {
                httpStatusCode: 500,
            },
        });

        const form = new FormData();
        form.append("photo", loadPngVehiclePhoto());

        const response = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
            payload: form,
            headers: form.getHeaders(),
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(500);
        expect(response.json().message).toEqual("Error while uploading photo");
        expect(cryptoRandomUUIDSpy.calledOnce).toBe(true);
        expect(vehiclePhotos.length).toEqual(0);
        expect(s3SendStub.calledOnce).toBe(true);
        expect(
            (s3SendStub.lastCall.firstArg as PutObjectCommand).input,
        ).toEqual({
            Bucket: app.config.S3_BUCKET_NAME,
            Key: `${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[0]}.png`,
            Body: expect.any(Buffer),
            ContentType: "image/png",
        });
    });
});
