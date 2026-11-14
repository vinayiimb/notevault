-- CreateTable
CREATE TABLE "StudentNoticeReply" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentNoticeReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentNoticeReply_noticeId_createdAt_idx" ON "StudentNoticeReply"("noticeId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentNoticeReply_email_idx" ON "StudentNoticeReply"("email");

-- AddForeignKey
ALTER TABLE "StudentNoticeReply" ADD CONSTRAINT "StudentNoticeReply_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "StudentNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
