-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selectionDue" DATE,
ADD COLUMN     "selectionTarget" INTEGER;

-- CreateTable
CREATE TABLE "ProofList" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "ProofList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofPick" (
    "listId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,

    CONSTRAINT "ProofPick_pkey" PRIMARY KEY ("listId","imageId")
);

-- CreateTable
CREATE TABLE "ProofNote" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProofList_projectId_actor_key" ON "ProofList"("projectId", "actor");

-- CreateIndex
CREATE INDEX "ProofPick_imageId_idx" ON "ProofPick"("imageId");

-- CreateIndex
CREATE INDEX "ProofNote_listId_idx" ON "ProofNote"("listId");

-- CreateIndex
CREATE INDEX "ProofNote_imageId_idx" ON "ProofNote"("imageId");

-- AddForeignKey
ALTER TABLE "ProofList" ADD CONSTRAINT "ProofList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofPick" ADD CONSTRAINT "ProofPick_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ProofList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofPick" ADD CONSTRAINT "ProofPick_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "SelectionImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofNote" ADD CONSTRAINT "ProofNote_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ProofList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofNote" ADD CONSTRAINT "ProofNote_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "SelectionImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
