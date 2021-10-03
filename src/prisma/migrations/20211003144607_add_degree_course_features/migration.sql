/*
  Warnings:

  - Made the column `role_group_id` on table `role_group_options` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "degrees" (
    "fenix_id" TEXT NOT NULL PRIMARY KEY,
    "acronym" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "degree_text_channel_id" TEXT,
    "degree_voice_channel_id" TEXT,
    "announcements_channel_id" TEXT,
    "course_selection_channel_id" TEXT
);

-- CreateTable
CREATE TABLE "courses" (
    "acronym" TEXT NOT NULL PRIMARY KEY,
    "display_acronym" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_id" TEXT,
    "role_id" TEXT,
    "hideChannel" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "degree_courses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "degree_fenix_id" TEXT NOT NULL,
    "course_acronym" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    CONSTRAINT "degree_courses_degree_fenix_id_fkey" FOREIGN KEY ("degree_fenix_id") REFERENCES "degrees" ("fenix_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "degree_courses_course_acronym_fkey" FOREIGN KEY ("course_acronym") REFERENCES "courses" ("acronym") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "course_role_selection_messages" (
    "injected_role_group_id" TEXT NOT NULL PRIMARY KEY,
    "message_id" TEXT NOT NULL
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

-- CreateIndex
CREATE UNIQUE INDEX "degrees_acronym_key" ON "degrees"("acronym");

-- CreateIndex
CREATE UNIQUE INDEX "degrees_name_key" ON "degrees"("name");

-- CreateIndex
CREATE UNIQUE INDEX "courses_display_acronym_key" ON "courses"("display_acronym");

-- CreateIndex
CREATE UNIQUE INDEX "courses_name_key" ON "courses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "courses_channel_id_key" ON "courses"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_role_id_key" ON "courses"("role_id");
