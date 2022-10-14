-- CreateEnum
CREATE TYPE "RentStatusEnum" AS ENUM ('Placed', 'Accepted', 'Rejected', 'During', 'Completed', 'Canceled');

-- CreateEnum
CREATE TYPE "UnitTypeEnum" AS ENUM ('Metric', 'Imperial');

-- CreateEnum
CREATE TYPE "FuelTypeEnum" AS ENUM ('Gas', 'Diesel', 'Electric', 'Hybrid');

-- CreateTable
CREATE TABLE "Rental" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unitTypeId" INTEGER NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalManager" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rentalId" INTEGER NOT NULL,

    CONSTRAINT "RentalManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitType" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" "UnitTypeEnum" NOT NULL,

    CONSTRAINT "UnitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelType" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" "FuelTypeEnum" NOT NULL,

    CONSTRAINT "FuelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "brand" VARCHAR(30) NOT NULL,
    "model" VARCHAR(50) NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "mileage" INTEGER NOT NULL,
    "licensePlate" VARCHAR(20) NOT NULL,
    "pricePerDay" DECIMAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fuelTypeId" INTEGER NOT NULL,
    "rentalId" INTEGER NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleEquipment" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "vehicleId" INTEGER NOT NULL,

    CONSTRAINT "VehicleEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleService" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" INTEGER NOT NULL,

    CONSTRAINT "VehicleService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePhoto" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "main" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" INTEGER NOT NULL,

    CONSTRAINT "VehiclePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rent" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "status" "RentStatusEnum" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,

    CONSTRAINT "Rent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "firstName" VARCHAR(30) NOT NULL,
    "lastName" VARCHAR(50) NOT NULL,
    "birthDate" DATE NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phoneNumber" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rent_customerId_key" ON "Rent"("customerId");

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_unitTypeId_fkey" FOREIGN KEY ("unitTypeId") REFERENCES "UnitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalManager" ADD CONSTRAINT "RentalManager_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_fuelTypeId_fkey" FOREIGN KEY ("fuelTypeId") REFERENCES "FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEquipment" ADD CONSTRAINT "VehicleEquipment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleService" ADD CONSTRAINT "VehicleService_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rent" ADD CONSTRAINT "Rent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rent" ADD CONSTRAINT "Rent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
