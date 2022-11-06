-- AlterTable
ALTER TABLE "RentalManager" ALTER COLUMN "activationToken" DROP NOT NULL,
ALTER COLUMN "activationTokenExpiration" DROP NOT NULL;
