-- RedefineTables
PRAGMA foreign_keys = OFF;
ALTER TABLE "courses"
  RENAME COLUMN "hideChannel" TO "hide_channel";
PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;