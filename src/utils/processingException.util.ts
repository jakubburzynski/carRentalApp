export class ProcessingException extends Error {
    public readonly statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);

        Object.setPrototypeOf(this, new.target.prototype);

        this.statusCode = statusCode;

        Error.captureStackTrace(this);
    }
}
