-- CreateEnum
CREATE TYPE "NotesOrderStatus" AS ENUM ('PAID', 'DELIVERED', 'REFUNDED');

-- CreateTable
CREATE TABLE "NotesOrder" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "programmeSlug" TEXT NOT NULL,
    "programme" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "subjectSlug" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT NOT NULL,
    "status" "NotesOrderStatus" NOT NULL DEFAULT 'PAID',
    "adminNote" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "NotesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotesOrder_razorpayOrderId_key" ON "NotesOrder"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "NotesOrder_razorpayPaymentId_key" ON "NotesOrder"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "NotesOrder_status_paidAt_idx" ON "NotesOrder"("status", "paidAt");

-- CreateIndex
CREATE INDEX "NotesOrder_phone_idx" ON "NotesOrder"("phone");
