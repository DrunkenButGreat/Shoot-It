-- AlterTable
ALTER TABLE "SelectionImage" ADD COLUMN     "editStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "due" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryLink" (
    "fileId" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryLink_pkey" PRIMARY KEY ("fileId")
);

-- CreateIndex
CREATE INDEX "PlanItem_projectId_kind_idx" ON "PlanItem"("projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryLink_digest_key" ON "DeliveryLink"("digest");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLink" ADD CONSTRAINT "DeliveryLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ResultFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
