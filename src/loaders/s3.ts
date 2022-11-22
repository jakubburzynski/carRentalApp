import { S3Client } from "@aws-sdk/client-s3";
import fp from "fastify-plugin";
import { FastifyPluginCallback } from "fastify";

let s3: S3Client;
let s3BucketName: string;
const s3Plugin: FastifyPluginCallback = (server, options, done) => {
    s3 = new S3Client({
        region: server.config.S3_REGION,
        credentials: {
            accessKeyId: server.config.S3_ACCESS_KEY_ID,
            secretAccessKey: server.config.S3_SECRET_ACCESS_KEY,
        },
        apiVersion: "2006-03-01",
    });
    s3BucketName = server.config.S3_BUCKET_NAME;

    server.decorate("s3", s3);

    server.addHook("onClose", (server) => {
        server.s3.destroy();
    });

    done();
};
export { s3, s3BucketName };

export default fp(s3Plugin);
