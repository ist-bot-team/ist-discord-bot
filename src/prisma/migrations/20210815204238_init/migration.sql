-- CreateTable
CREATE TABLE "config" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "attendance_polls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL
);
