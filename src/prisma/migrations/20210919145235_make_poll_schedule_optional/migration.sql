-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_polls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cron" TEXT,
    "channel_id" TEXT NOT NULL
);
INSERT INTO "new_polls" ("channel_id", "cron", "id", "title", "type") SELECT "channel_id", "cron", "id", "title", "type" FROM "polls";
DROP TABLE "polls";
ALTER TABLE "new_polls" RENAME TO "polls";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
