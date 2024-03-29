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
    VehiclePhoto,
} from "@prisma/client";
import argon2 from "argon2";
import FormData from "form-data";
import path from "node:path";
import sinon, { SinonSpiedMember, SinonStubbedMember } from "sinon";
import crypto from "node:crypto";
import { createReadStream, ReadStream } from "node:fs";
import {
    DeleteObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

import cleanupDatabase from "../../../test/utils/cleanupDatabase";
import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";
import { POSITION_GAP, POSITION_OFFSET } from "./vehiclePhoto.service";

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
            position: POSITION_OFFSET,
        });
        expect(cryptoRandomUUIDSpy.calledOnce).toBe(true);
        expect(vehiclePhotos.length).toEqual(1);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(POSITION_OFFSET);
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
            position: POSITION_OFFSET,
        });
        expect(cryptoRandomUUIDSpy.calledOnce).toBe(true);
        expect(vehiclePhotos.length).toEqual(1);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(POSITION_OFFSET);
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
            position: POSITION_OFFSET,
        });
        expect(secondResponse.statusCode).toBe(201);
        expect(secondResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[1]}.png`,
            position: POSITION_OFFSET + POSITION_GAP,
        });
        expect(thirdResponse.statusCode).toBe(201);
        expect(thirdResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[2]}.jpeg`,
            position: POSITION_OFFSET + POSITION_GAP * 2,
        });
        expect(cryptoRandomUUIDSpy.calledThrice).toBe(true);
        expect(vehiclePhotos.length).toEqual(3);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(POSITION_OFFSET);
        expect(vehiclePhotos[0].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[1].uuid).toBe(cryptoRandomUUIDSpy.returnValues[1]);
        expect(vehiclePhotos[1].position).toBe(POSITION_OFFSET + POSITION_GAP);
        expect(vehiclePhotos[1].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[2].uuid).toBe(cryptoRandomUUIDSpy.returnValues[2]);
        expect(vehiclePhotos[2].position).toBe(
            POSITION_OFFSET + POSITION_GAP * 2,
        );
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
            position: POSITION_OFFSET,
        });
        expect(secondResponse.statusCode).toBe(201);
        expect(secondResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${secondVehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[1]}.png`,
            position: POSITION_OFFSET,
        });
        expect(thirdResponse.statusCode).toBe(201);
        expect(thirdResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[2]}.png`,
            position: POSITION_OFFSET + POSITION_GAP,
        });
        expect(fourthResponse.statusCode).toBe(201);
        expect(fourthResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${secondVehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[3]}.jpeg`,
            position: POSITION_OFFSET + POSITION_GAP,
        });
        expect(cryptoRandomUUIDSpy.callCount).toBe(4);
        expect(vehiclePhotos.length).toEqual(4);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(POSITION_OFFSET);
        expect(vehiclePhotos[0].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[1].uuid).toBe(cryptoRandomUUIDSpy.returnValues[1]);
        expect(vehiclePhotos[1].position).toBe(POSITION_OFFSET);
        expect(vehiclePhotos[1].vehicleId).toBe(secondVehicle.id);
        expect(vehiclePhotos[2].uuid).toBe(cryptoRandomUUIDSpy.returnValues[2]);
        expect(vehiclePhotos[2].position).toBe(POSITION_OFFSET + POSITION_GAP);
        expect(vehiclePhotos[2].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[3].uuid).toBe(cryptoRandomUUIDSpy.returnValues[3]);
        expect(vehiclePhotos[3].position).toBe(POSITION_OFFSET + POSITION_GAP);
        expect(vehiclePhotos[3].vehicleId).toBe(secondVehicle.id);
        expect(s3SendStub.callCount).toBe(4);
    });

    test("should maintain order when difference between positions is not equal", async () => {
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

        await app.prisma.vehiclePhoto.delete({
            where: {
                uuid: secondResponse.json().uuid,
            },
        });

        const fourthForm = new FormData();
        fourthForm.append("photo", loadPngVehiclePhoto());
        const fourthResponse = await app.inject({
            method: "POST",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos`,
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
            position: POSITION_OFFSET,
        });
        expect(secondResponse.statusCode).toBe(201);
        expect(secondResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[1]}.png`,
            position: POSITION_OFFSET + POSITION_GAP,
        });
        expect(thirdResponse.statusCode).toBe(201);
        expect(thirdResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[2]}.jpeg`,
            position: POSITION_OFFSET + POSITION_GAP * 2,
        });
        expect(fourthResponse.statusCode).toBe(201);
        expect(fourthResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            url: `${s3BucketBaseUrl}/${vehicle.uuid}/${cryptoRandomUUIDSpy.returnValues[3]}.png`,
            position: POSITION_OFFSET + POSITION_GAP * 3,
        });
        expect(cryptoRandomUUIDSpy.callCount).toBe(4);
        expect(vehiclePhotos.length).toEqual(3);
        expect(vehiclePhotos[0].uuid).toBe(cryptoRandomUUIDSpy.returnValues[0]);
        expect(vehiclePhotos[0].position).toBe(POSITION_OFFSET);
        expect(vehiclePhotos[0].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[1].uuid).toBe(cryptoRandomUUIDSpy.returnValues[2]);
        expect(vehiclePhotos[1].position).toBe(
            POSITION_OFFSET + POSITION_GAP * 2,
        );
        expect(vehiclePhotos[1].vehicleId).toBe(vehicle.id);
        expect(vehiclePhotos[2].uuid).toBe(cryptoRandomUUIDSpy.returnValues[3]);
        expect(vehiclePhotos[2].position).toBe(
            POSITION_OFFSET + POSITION_GAP * 3,
        );
        expect(vehiclePhotos[2].vehicleId).toBe(vehicle.id);
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

    test("should check if currently logged in rental manager has rights to upload vehicle photo", async () => {
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

describe("PATCH /api/v1/vehicles/:vehicleUuid/photos/:photoUuid", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let secondRental: Rental;
    let rentalManager: RentalManager;
    let secondRentalManager: RentalManager;
    let fuelTypes: FuelType[];
    let vehicle: Vehicle;
    let zerothVehiclePhoto: VehiclePhoto;
    let firstVehiclePhoto: VehiclePhoto;
    let secondVehiclePhoto: VehiclePhoto;
    let thirdVehiclePhoto: VehiclePhoto;
    let fourthVehiclePhoto: VehiclePhoto;
    let sessionId: string;
    let secondSessionId: string;
    let baseCorrectOrder: { uuid: string; position: number }[];

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

    beforeEach(async () => {
        const getUuid = () => crypto.randomUUID();
        let vehiclePhotoUuid = getUuid();
        zerothVehiclePhoto = await app.prisma.vehiclePhoto.create({
            data: {
                uuid: vehiclePhotoUuid,
                url: `https://s3.${app.config.S3_REGION}.amazonaws.com/${app.config.S3_BUCKET_NAME}/${vehicle.uuid}/${vehiclePhotoUuid}.png`,
                position: POSITION_OFFSET,
                vehicle: {
                    connect: {
                        id: vehicle.id,
                    },
                },
            },
        });
        vehiclePhotoUuid = getUuid();
        firstVehiclePhoto = await app.prisma.vehiclePhoto.create({
            data: {
                uuid: vehiclePhotoUuid,
                url: `https://s3.${app.config.S3_REGION}.amazonaws.com/${app.config.S3_BUCKET_NAME}/${vehicle.uuid}/${vehiclePhotoUuid}.png`,
                position: POSITION_OFFSET + POSITION_GAP,
                vehicle: {
                    connect: {
                        id: vehicle.id,
                    },
                },
            },
        });
        vehiclePhotoUuid = getUuid();
        secondVehiclePhoto = await app.prisma.vehiclePhoto.create({
            data: {
                uuid: vehiclePhotoUuid,
                url: `https://s3.${app.config.S3_REGION}.amazonaws.com/${app.config.S3_BUCKET_NAME}/${vehicle.uuid}/${vehiclePhotoUuid}.png`,
                position: POSITION_OFFSET + POSITION_GAP * 2,
                vehicle: {
                    connect: {
                        id: vehicle.id,
                    },
                },
            },
        });
        vehiclePhotoUuid = getUuid();
        thirdVehiclePhoto = await app.prisma.vehiclePhoto.create({
            data: {
                uuid: vehiclePhotoUuid,
                url: `https://s3.${app.config.S3_REGION}.amazonaws.com/${app.config.S3_BUCKET_NAME}/${vehicle.uuid}/${vehiclePhotoUuid}.png`,
                position: POSITION_OFFSET + POSITION_GAP * 3,
                vehicle: {
                    connect: {
                        id: vehicle.id,
                    },
                },
            },
        });
        vehiclePhotoUuid = getUuid();
        fourthVehiclePhoto = await app.prisma.vehiclePhoto.create({
            data: {
                uuid: vehiclePhotoUuid,
                url: `https://s3.${app.config.S3_REGION}.amazonaws.com/${app.config.S3_BUCKET_NAME}/${vehicle.uuid}/${vehiclePhotoUuid}.png`,
                position: POSITION_OFFSET + POSITION_GAP * 4,
                vehicle: {
                    connect: {
                        id: vehicle.id,
                    },
                },
            },
        });
        baseCorrectOrder = [
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
        ];
    });

    afterEach(async () => {
        await app.prisma.vehiclePhoto.deleteMany();
    });

    afterAll(async () => {
        await cleanupDatabase(app.prisma);
        await app.close();
    });

    test("should move photo one position forward", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${secondVehiclePhoto.uuid}`,
            payload: { position: 3 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position:
                    POSITION_OFFSET +
                    POSITION_GAP * 3 +
                    Math.floor(
                        Math.abs(
                            POSITION_OFFSET +
                                POSITION_GAP * 3 -
                                (POSITION_OFFSET + POSITION_GAP * 4),
                        ) / 2,
                    ),
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: secondVehiclePhoto.uuid,
            position: correctOrder[3].position,
            url: secondVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo more than one position forward", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 2 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: zerothVehiclePhoto.uuid,
                position:
                    POSITION_OFFSET +
                    POSITION_GAP * 2 +
                    Math.floor(
                        Math.abs(
                            POSITION_OFFSET +
                                POSITION_GAP * 2 -
                                (POSITION_OFFSET + POSITION_GAP * 3),
                        ) / 2,
                    ),
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position: correctOrder[2].position,
            url: zerothVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo one position backward", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${fourthVehiclePhoto.uuid}`,
            payload: { position: 3 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position:
                    POSITION_OFFSET +
                    POSITION_GAP * 2 +
                    Math.floor(
                        Math.abs(
                            POSITION_OFFSET +
                                POSITION_GAP * 2 -
                                (POSITION_OFFSET + POSITION_GAP * 3),
                        ) / 2,
                    ),
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: fourthVehiclePhoto.uuid,
            position: correctOrder[3].position,
            url: fourthVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo more than one position backward", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${thirdVehiclePhoto.uuid}`,
            payload: { position: 1 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: thirdVehiclePhoto.uuid,
                position:
                    POSITION_OFFSET +
                    Math.floor(
                        Math.abs(
                            POSITION_OFFSET - (POSITION_OFFSET + POSITION_GAP),
                        ) / 2,
                    ),
            },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: thirdVehiclePhoto.uuid,
            position: correctOrder[1].position,
            url: thirdVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo to first (1 position)", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET - POSITION_GAP,
            },
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: correctOrder[0].position,
            url: firstVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo to first (1+ positions)", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${thirdVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET - POSITION_GAP,
            },
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: thirdVehiclePhoto.uuid,
            position: correctOrder[0].position,
            url: thirdVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo to last (1 position)", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${thirdVehiclePhoto.uuid}`,
            payload: { position: 4 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4 + POSITION_GAP,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: thirdVehiclePhoto.uuid,
            position: correctOrder[4].position,
            url: thirdVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo to last (1+ positions)", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 4 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4 + POSITION_GAP,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: correctOrder[4].position,
            url: firstVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo from first to last", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 4 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4,
            },
            {
                uuid: zerothVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 4 + POSITION_GAP,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position: correctOrder[4].position,
            url: zerothVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should move photo from last to first", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${fourthVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            {
                uuid: fourthVehiclePhoto.uuid,
                position: POSITION_OFFSET - POSITION_GAP,
            },
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 2,
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: fourthVehiclePhoto.uuid,
            position: correctOrder[0].position,
            url: fourthVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should set correct position if gap is bigger than standard", async () => {
        await app.prisma.vehiclePhoto.delete({
            where: {
                uuid: secondVehiclePhoto.uuid,
            },
        });
        /*
            Current order
             0   1   2   3   4
             0   1       2   3
        */
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${fourthVehiclePhoto.uuid}`,
            payload: { position: 2 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position:
                    POSITION_OFFSET +
                    POSITION_GAP +
                    Math.floor(
                        Math.abs(
                            POSITION_OFFSET +
                                POSITION_GAP -
                                (POSITION_OFFSET + POSITION_GAP * 3),
                        ) / 2,
                    ),
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: fourthVehiclePhoto.uuid,
            position: correctOrder[2].position,
            url: fourthVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(4);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should set correct position if gap is smaller than standard", async () => {
        await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${fourthVehiclePhoto.uuid}`,
            payload: { position: 2 },
            cookies: {
                sessionId,
            },
        });
        /*
            Current order
             0   1   2   3   4
             0   1   4   2   3
        */
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${secondVehiclePhoto.uuid}`,
            payload: { position: 2 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            { uuid: zerothVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
            {
                uuid: secondVehiclePhoto.uuid,
                position:
                    POSITION_OFFSET +
                    POSITION_GAP +
                    Math.floor(
                        Math.abs(
                            POSITION_OFFSET +
                                POSITION_GAP -
                                (POSITION_OFFSET +
                                    POSITION_GAP +
                                    Math.floor(
                                        Math.abs(
                                            POSITION_OFFSET +
                                                POSITION_GAP -
                                                (POSITION_OFFSET +
                                                    POSITION_GAP * 2),
                                        ) / 2,
                                    )),
                        ) / 2,
                    ),
            },
            {
                uuid: fourthVehiclePhoto.uuid,
                position:
                    POSITION_OFFSET +
                    POSITION_GAP +
                    Math.floor(
                        Math.abs(
                            POSITION_OFFSET +
                                POSITION_GAP -
                                (POSITION_OFFSET + POSITION_GAP * 2),
                        ) / 2,
                    ),
            },
            {
                uuid: thirdVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP * 3,
            },
        ];
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: secondVehiclePhoto.uuid,
            position: correctOrder[2].position,
            url: secondVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should handle multiple moves (2 photos) #1", async () => {
        await app.prisma.vehiclePhoto.deleteMany({
            where: {
                position: {
                    gt: POSITION_OFFSET + POSITION_GAP,
                },
            },
        });
        /*
            Current order
             0   1   2   3   4
             0   1
        */
        const firstResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(firstResponse.statusCode).toBe(200);
        expect(firstResponse.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP,
            url: firstVehiclePhoto.url,
        });
        const secondResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(secondResponse.statusCode).toBe(200);
        expect(secondResponse.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP * 2,
            url: zerothVehiclePhoto.url,
        });
        const thirdResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 1 },
            cookies: {
                sessionId,
            },
        });
        expect(thirdResponse.statusCode).toBe(200);
        expect(thirdResponse.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position: POSITION_OFFSET,
            url: zerothVehiclePhoto.url,
        });
        const fourthResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(fourthResponse.statusCode).toBe(200);
        expect(fourthResponse.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP * 2,
            url: zerothVehiclePhoto.url,
        });
        const fifthResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(fifthResponse.statusCode).toBe(200);
        expect(fifthResponse.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP * 3,
            url: firstVehiclePhoto.url,
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET - POSITION_GAP * 3,
            },
            {
                uuid: zerothVehiclePhoto.uuid,
                position: POSITION_OFFSET - POSITION_GAP * 2,
            },
        ];
        expect(vehiclePhotos.length).toBe(2);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should handle multiple moves (2 photos) #2", async () => {
        await app.prisma.vehiclePhoto.deleteMany({
            where: {
                position: {
                    gt: POSITION_OFFSET + POSITION_GAP,
                },
            },
        });
        /*
            Current order
             0   1   2   3   4
             0   1
        */
        const firstResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(firstResponse.statusCode).toBe(200);
        expect(firstResponse.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP,
            url: firstVehiclePhoto.url,
        });
        const secondResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(secondResponse.statusCode).toBe(200);
        expect(secondResponse.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP * 2,
            url: zerothVehiclePhoto.url,
        });
        const thirdResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(thirdResponse.statusCode).toBe(200);
        expect(thirdResponse.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP * 3,
            url: firstVehiclePhoto.url,
        });
        const fourthResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(fourthResponse.statusCode).toBe(200);
        expect(fourthResponse.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP * 4,
            url: zerothVehiclePhoto.url,
        });
        const fifthResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(fifthResponse.statusCode).toBe(200);
        expect(fifthResponse.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP * 5,
            url: firstVehiclePhoto.url,
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET - POSITION_GAP * 5,
            },
            {
                uuid: zerothVehiclePhoto.uuid,
                position: POSITION_OFFSET - POSITION_GAP * 4,
            },
        ];
        expect(vehiclePhotos.length).toBe(2);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should handle multiple moves (3 photos) #1", async () => {
        await app.prisma.vehiclePhoto.deleteMany({
            where: {
                position: {
                    gt: POSITION_OFFSET + POSITION_GAP * 2,
                },
            },
        });
        /*
            Current order
             0   1   2   3   4
             0   1   2
        */

        const firstResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 1 },
            cookies: {
                sessionId,
            },
        });
        expect(firstResponse.statusCode).toBe(200);
        expect(firstResponse.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position:
                POSITION_OFFSET +
                POSITION_GAP +
                Math.floor(
                    Math.abs(
                        POSITION_OFFSET +
                            POSITION_GAP -
                            (POSITION_OFFSET + POSITION_GAP * 2),
                    ) / 2,
                ),
            url: zerothVehiclePhoto.url,
        });
        /*
            Current order
             0   1   2   3   4
             1   0   2
        */

        const secondResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${secondVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(secondResponse.statusCode).toBe(200);
        expect(secondResponse.json()).toMatchObject({
            uuid: secondVehiclePhoto.uuid,
            position: POSITION_OFFSET,
            url: secondVehiclePhoto.url,
        });
        /*
            Current order
             0   1   2   3   4
             2   1   0 
        */

        const thirdResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 0 },
            cookies: {
                sessionId,
            },
        });
        expect(thirdResponse.statusCode).toBe(200);
        expect(thirdResponse.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: POSITION_OFFSET - POSITION_GAP,
            url: firstVehiclePhoto.url,
        });
        /*
            Current order
             0   1   2   3   4
             1   2   0 
        */

        const fourthResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${zerothVehiclePhoto.uuid}`,
            payload: { position: 1 },
            cookies: {
                sessionId,
            },
        });
        expect(fourthResponse.statusCode).toBe(200);
        expect(fourthResponse.json()).toMatchObject({
            uuid: zerothVehiclePhoto.uuid,
            position:
                POSITION_OFFSET -
                POSITION_GAP +
                Math.floor(
                    Math.abs(POSITION_OFFSET - POSITION_GAP - POSITION_OFFSET) /
                        2,
                ),
            url: zerothVehiclePhoto.url,
        });
        /*
            Current order
             0   1   2   3   4
             1   0   2 
        */

        const fifthResponse = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 2 },
            cookies: {
                sessionId,
            },
        });
        expect(fifthResponse.statusCode).toBe(200);
        expect(fifthResponse.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: POSITION_OFFSET + POSITION_GAP,
            url: firstVehiclePhoto.url,
        });
        /*
            Current order
             0   1   2   3   4
             0   2   1
        */

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        const correctOrder = [
            {
                uuid: zerothVehiclePhoto.uuid,
                position:
                    POSITION_OFFSET -
                    POSITION_GAP +
                    Math.floor(
                        Math.abs(
                            POSITION_OFFSET - POSITION_GAP - POSITION_OFFSET,
                        ) / 2,
                    ),
            },
            { uuid: secondVehiclePhoto.uuid, position: POSITION_OFFSET },
            {
                uuid: firstVehiclePhoto.uuid,
                position: POSITION_OFFSET + POSITION_GAP,
            },
        ];
        expect(vehiclePhotos.length).toBe(3);
        expect(vehiclePhotosUuidPosition).toEqual(correctOrder);
    });

    test("should check if new position matches old position", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 1 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            uuid: firstVehiclePhoto.uuid,
            position: baseCorrectOrder[1].position,
            url: firstVehiclePhoto.url,
        });
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should check for not existing vehicle", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${faker.datatype.uuid()}/photos/${
                firstVehiclePhoto.uuid
            }`,
            payload: { position: 3 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(404);
        expect(response.json().message).toEqual("Invalid vehicle uuid");
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should check for not existing photo", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${
                vehicle.uuid
            }/photos/${faker.datatype.uuid()}`,
            payload: { position: 3 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(404);
        expect(response.json().message).toEqual("Invalid vehicle photo uuid");
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should not update if rental manager is not logged in", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 3 },
            cookies: undefined,
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(401);
        expect(response.json().message).toEqual("Not authenticated");
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should check if currently logged in rental manager has rights to update vehicle photo", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 3 },
            cookies: {
                sessionId: secondSessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(403);
        expect(response.json().message).toEqual(
            "Not authorized to maintain this vehicle",
        );
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should check if vehicleUuid param is a valid uuid", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/123/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 3 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/vehicleUuid must match format "uuid"',
        );
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should check if photoUuid param is a valid uuid", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/123`,
            payload: { position: 1 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/photoUuid must match format "uuid"',
        );
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should check if body is present", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("body must be object");
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should check if position value is non negative", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: -1 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("body/position must be >= 0");
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });

    test("should check if position value is not bigger than index of last vehicle photo", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${firstVehiclePhoto.uuid}`,
            payload: { position: 5 },
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany({
            orderBy: {
                position: "asc",
            },
        });
        const vehiclePhotosUuidPosition = vehiclePhotos.map((p) => ({
            uuid: p.uuid,
            position: p.position,
        }));
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("body/position must be <= 4");
        expect(vehiclePhotos.length).toBe(5);
        expect(vehiclePhotosUuidPosition).toEqual(baseCorrectOrder);
    });
});

describe("DELETE /api/v1/vehicles/:vehicleUuid/photos/:photoUuid", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let secondRental: Rental;
    let rentalManager: RentalManager;
    let secondRentalManager: RentalManager;
    let fuelTypes: FuelType[];
    let vehicle: Vehicle;
    let vehiclePhoto: VehiclePhoto;
    let s3SendStub: SinonStubbedMember<typeof S3Client.prototype.send>;
    let sessionId: string;
    let secondSessionId: string;

    const examplePassword = "Q2Fz Zj{d";

    beforeAll(async () => {
        s3SendStub = sinon.stub(S3Client.prototype, "send").resolves({
            $metadata: {
                httpStatusCode: 204,
            },
        });
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

    beforeEach(async () => {
        const vehiclePhotoUuid = crypto.randomUUID();
        vehiclePhoto = await app.prisma.vehiclePhoto.create({
            data: {
                uuid: vehiclePhotoUuid,
                url: `https://s3.${app.config.S3_REGION}.amazonaws.com/${app.config.S3_BUCKET_NAME}/${vehicle.uuid}/${vehiclePhotoUuid}.png`,
                position: 128,
                vehicle: {
                    connect: {
                        id: vehicle.id,
                    },
                },
            },
        });
    });

    afterEach(async () => {
        s3SendStub.resetHistory();
        await app.prisma.vehiclePhoto.deleteMany();
    });

    afterAll(async () => {
        s3SendStub.restore();
        await cleanupDatabase(app.prisma);
        await app.close();
    });

    test("should delete a photo (both from S3 and database)", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${vehiclePhoto.uuid}`,
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(204);
        expect(response.body).toEqual("");
        expect(vehiclePhotos.length).toBe(0);
        expect(s3SendStub.calledOnce).toBe(true);
        expect(
            (s3SendStub.lastCall.firstArg as DeleteObjectCommand).input,
        ).toEqual({
            Bucket: app.config.S3_BUCKET_NAME,
            Key: `${vehicle.uuid}/${vehiclePhoto.uuid}.png`,
        });
    });

    test("should check for not existing photo", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${
                vehicle.uuid
            }/photos/${faker.datatype.uuid()}`,
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(404);
        expect(response.json().message).toEqual("Invalid photo uuid");
        expect(vehiclePhotos.length).toBe(1);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should check for not existing vehicle", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${faker.datatype.uuid()}/photos/${
                vehiclePhoto.uuid
            }`,
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(404);
        expect(response.json().message).toEqual("Invalid vehicle uuid");
        expect(vehiclePhotos.length).toBe(1);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should not delete if rental manager is not logged in", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${vehiclePhoto.uuid}`,
            cookies: undefined,
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(401);
        expect(response.json().message).toEqual("Not authenticated");
        expect(vehiclePhotos.length).toBe(1);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should check if currently logged in rental manager has rights to delete vehicle photo", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${vehiclePhoto.uuid}`,
            cookies: {
                sessionId: secondSessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(403);
        expect(response.json().message).toEqual(
            "Not authorized to maintain this vehicle's photos",
        );
        expect(vehiclePhotos.length).toBe(1);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should check if vehicleUuid param is a valid uuid", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/123/photos/${vehiclePhoto.uuid}`,
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/vehicleUuid must match format "uuid"',
        );
        expect(vehiclePhotos.length).toBe(1);
        expect(s3SendStub.notCalled).toBe(true);
    });

    test("should check if photoUuid param is a valid uuid", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/123`,
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/photoUuid must match format "uuid"',
        );
        expect(vehiclePhotos.length).toBe(1);
        expect(s3SendStub.notCalled).toBe(true);
    });

    // from this place s3SendStub resolves with 500 status code
    test("should not delete image entity if deleting from S3 fails", async () => {
        s3SendStub.restore();
        s3SendStub = sinon.stub(S3Client.prototype, "send").resolves({
            $metadata: {
                httpStatusCode: 500,
            },
        });

        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/vehicles/${vehicle.uuid}/photos/${vehiclePhoto.uuid}`,
            cookies: {
                sessionId,
            },
        });

        const vehiclePhotos = await app.prisma.vehiclePhoto.findMany();
        expect(response.statusCode).toBe(500);
        expect(response.json().message).toEqual("Error while deleting photo");
        expect(vehiclePhotos.length).toBe(1);
        expect(s3SendStub.calledOnce).toBe(true);
        expect(
            (s3SendStub.lastCall.firstArg as DeleteObjectCommand).input,
        ).toEqual({
            Bucket: app.config.S3_BUCKET_NAME,
            Key: `${vehicle.uuid}/${vehiclePhoto.uuid}.png`,
        });
    });
});
