/*
  Warnings:

  - Made the column `role_group_id` on table `role_group_options` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "Degree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "acronym" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fenix_name" TEXT,
    "emoji" TEXT,
    "role_id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "acronym" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "announcements_url" TEXT,
    "degree_id" TEXT NOT NULL,
    CONSTRAINT "Course_degree_id_fkey" FOREIGN KEY ("degree_id") REFERENCES "Degree" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "guid" TEXT NOT NULL PRIMARY KEY,
    "message_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    CONSTRAINT "Announcement_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_role_group_options" (
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" TEXT NOT NULL PRIMARY KEY,
    "emoji" TEXT,
    "role_group_id" TEXT NOT NULL,
    CONSTRAINT "role_group_options_role_group_id_fkey" FOREIGN KEY ("role_group_id") REFERENCES "role_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_role_group_options" ("description", "emoji", "label", "role_group_id", "value") SELECT "description", "emoji", "label", "role_group_id", "value" FROM "role_group_options";
DROP TABLE "role_group_options";
ALTER TABLE "new_role_group_options" RENAME TO "role_group_options";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
