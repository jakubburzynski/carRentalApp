/*
  Warnings:

  - You are about to drop the column `main` on the `VehiclePhoto` table. All the data in the column will be lost.
  - Added the required column `position` to the `VehiclePhoto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VehiclePhoto" DROP COLUMN "main",
ADD COLUMN     "position" INTEGER NOT NULL;
