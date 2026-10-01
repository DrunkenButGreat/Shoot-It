CREATE TABLE "ProjectVisit" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectVisit_pkey" PRIMARY KEY ("userId", "projectId"),
    CONSTRAINT "ProjectVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProjectVisit_userId_openedAt_idx" ON "ProjectVisit"("userId", "openedAt");
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "landingImage" TEXT,
    "loginImage" TEXT,
    "signupImage" TEXT,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
