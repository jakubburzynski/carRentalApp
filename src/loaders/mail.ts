import sgMail from "@sendgrid/mail";

import { EnvConfig } from "./env";

let senderEmail: string;
let senderName: string;
export function setupMailService(config: EnvConfig) {
    sgMail.setApiKey(config.SENDGRID_API_KEY);
    senderEmail = config.SENDGRID_SENDER_ADDRESS;
    senderName = config.SENDGRID_SENDER_NAME;
}

interface MailSendOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
}
interface MailingService {
    send: (options: MailSendOptions) => Promise<void>;
}
const mailingService: MailingService = {
    send: async (options) => {
        await sgMail.send({
            from: {
                email: senderEmail,
                name: senderName,
            },
            ...options,
        });
    },
};

export default mailingService;
