/*
  Warnings:

  - You are about to drop the `Course` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Degree` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DegreeCourse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Course";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Degree";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DegreeCourse";
PRAGMA foreign_keys=on;

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
