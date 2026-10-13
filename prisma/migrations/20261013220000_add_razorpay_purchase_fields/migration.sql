-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'upi',
ADD COLUMN     "razorpayOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_razorpayOrderId_key" ON "Purchase"("razorpayOrderId");
