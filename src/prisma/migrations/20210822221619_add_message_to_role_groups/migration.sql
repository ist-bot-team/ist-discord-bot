/*
  Warnings:

  - Added the required column `message` to the `role_groups` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_role_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "placeholder" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "min_values" INTEGER,
    "max_values" INTEGER,
    "channel_id" TEXT NOT NULL
);
INSERT INTO "new_role_groups" ("channel_id", "id", "max_values", "min_values", "mode", "placeholder") SELECT "channel_id", "id", "max_values", "min_values", "mode", "placeholder" FROM "role_groups";
DROP TABLE "role_groups";
ALTER TABLE "new_role_groups" RENAME TO "role_groups";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
