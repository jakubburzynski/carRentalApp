/*
  Warnings:

  - A unique constraint covering the columns `[uuid]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `FuelType` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Rent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Rental` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `RentalManager` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `UnitType` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `VehicleEquipment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `VehiclePhoto` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `VehicleService` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Customer_uuid_key" ON "Customer"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "FuelType_uuid_key" ON "FuelType"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Rent_uuid_key" ON "Rent"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_uuid_key" ON "Rental"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "RentalManager_uuid_key" ON "RentalManager"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "UnitType_uuid_key" ON "UnitType"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_uuid_key" ON "Vehicle"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleEquipment_uuid_key" ON "VehicleEquipment"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePhoto_uuid_key" ON "VehiclePhoto"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleService_uuid_key" ON "VehicleService"("uuid");
