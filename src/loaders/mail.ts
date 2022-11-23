import sgMail from "@sendgrid/mail";
import { FastifyPluginCallback } from "fastify";
import fp from "fastify-plugin";

interface MailingServiceOptions {
    sendgridApiKey: string;
    senderEmail: string;
    senderName: string;
}
interface MailSendOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
}
class MailingService {
    senderEmail: string;
    senderName: string;
    constructor(options: MailingServiceOptions) {
        sgMail.setApiKey(options.sendgridApiKey);
        this.senderEmail = options.senderEmail;
        this.senderName = options.senderName;
    }

    async send(options: MailSendOptions): Promise<void> {
        await sgMail.send({
            from: {
                email: this.senderEmail,
                name: this.senderName,
            },
            ...options,
        });
    }
}
let mailingService: MailingService;
const mailPlugin: FastifyPluginCallback = (server, options, done) => {
    mailingService = new MailingService({
        sendgridApiKey: server.config.SENDGRID_API_KEY,
        senderEmail: server.config.SENDGRID_SENDER_ADDRESS,
        senderName: server.config.SENDGRID_SENDER_NAME,
    });

    server.decorate("mail", mailingService);

    done();
};

export { mailingService, MailingService };
export default fp(mailPlugin);
