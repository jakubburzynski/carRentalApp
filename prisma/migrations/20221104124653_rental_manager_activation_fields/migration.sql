/*
  Warnings:

  - Added the required column `activationToken` to the `RentalManager` table without a default value. This is not possible if the table is not empty.
  - Added the required column `activationTokenExpiration` to the `RentalManager` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RentalManager" ADD COLUMN     "activationToken" TEXT NOT NULL,
ADD COLUMN     "activationTokenExpiration" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false;
