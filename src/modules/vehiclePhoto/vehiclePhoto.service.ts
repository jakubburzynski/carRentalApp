import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { MultipartFile } from "@fastify/multipart";
import { FastifyError } from "fastify";
import bytes from "bytes";

import { prisma } from "../../loaders/prisma";
import { s3, s3BucketName } from "../../loaders/s3";
import { ProcessingException } from "../../utils/processingException.util";
import { findVehicleByUuid } from "../vehicle/vehicle.service";
import isFastifyError from "../../utils/isFastifyError.util";

export async function uploadVehiclePhoto(
    vehicleUuid: string,
    rentalUuid: string,
    photo: MultipartFile,
) {
    if (photo.mimetype !== "image/jpeg" && photo.mimetype !== "image/png") {
        throw new ProcessingException(
            415,
            "Unsupported vehicle photo extension",
        );
    }

    const vehicle = await findVehicleByUuid(vehicleUuid, true);
    if (!vehicle) {
        throw new ProcessingException(409, "Invalid vehicle uuid");
    }
    if (vehicle.rental.uuid !== rentalUuid) {
        throw new ProcessingException(
            403,
            "Not authorized to maintain this vehicle",
        );
    }

    let photoBuffer: Buffer | undefined;
    try {
        // throws when file size is over limit
        photoBuffer = await photo.toBuffer();
    } catch (err) {
        if (isFastifyError(err) && err.code === "FST_REQ_FILE_TOO_LARGE") {
            throw new ProcessingException(
                413,
                `Vehicle photo size should not exceed ${bytes(
                    (err as FastifyError & { part: MultipartFile }).part.file
                        .bytesRead,
                )}`,
            );
        }
        throw err;
    }

    const photoEntityUuid = randomUUID();
    const extension = photo.mimetype.split("/")[1];
    const fileName = `${vehicle.uuid}/${photoEntityUuid}.${extension}`;
    const s3Region = await s3.config.region();
    const photoUrl = `https://s3.${s3Region}.amazonaws.com/${s3BucketName}/${fileName}`;

    const vehiclePhotoCount = await prisma.vehiclePhoto.count({
        where: {
            vehicleId: vehicle.id,
        },
    });
    const createdVehiclePhoto = await prisma.vehiclePhoto.create({
        data: {
            uuid: photoEntityUuid,
            position: 128 * (vehiclePhotoCount + 1),
            url: photoUrl,
            vehicle: {
                connect: {
                    id: vehicle.id,
                },
            },
        },
    });

    const command = new PutObjectCommand({
        Bucket: s3BucketName,
        Key: fileName,
        Body: photoBuffer,
        ContentType: photo.mimetype,
    });

    const data = await s3.send(command);
    if (data["$metadata"].httpStatusCode !== 200) {
        await prisma.vehiclePhoto.delete({
            where: {
                id: createdVehiclePhoto.id,
            },
        });
        throw new ProcessingException(500, "Error while uploading photo");
    }

    return createdVehiclePhoto;
}
