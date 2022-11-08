/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `RentalManager` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RentalManager_email_key" ON "RentalManager"("email");
