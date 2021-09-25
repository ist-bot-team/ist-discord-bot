/*
  Warnings:

  - You are about to drop the `Announcement` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `Degree` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `emoji` on the `Degree` table. All the data in the column will be lost.
  - You are about to drop the column `fenix_name` on the `Degree` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `Degree` table. All the data in the column will be lost.
  - The primary key for the `Course` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `announcements_url` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `degree_id` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Course` table. All the data in the column will be lost.
  - Added the required column `fenix_id` to the `Degree` table without a default value. This is not possible if the table is not empty.
  - Added the required column `channel_id` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `display_acronym` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role_id` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Announcement";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "DegreeCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "degreeFenixId" TEXT NOT NULL,
    "courseAcronym" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    CONSTRAINT "DegreeCourse_degreeFenixId_fkey" FOREIGN KEY ("degreeFenixId") REFERENCES "Degree" ("fenix_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DegreeCourse_courseAcronym_fkey" FOREIGN KEY ("courseAcronym") REFERENCES "Course" ("acronym") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Degree" (
    "fenix_id" TEXT NOT NULL PRIMARY KEY,
    "acronym" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "course_selection_channel_id" TEXT,
    "degree_text_channel_id" TEXT,
    "degree_voice_channel_id" TEXT,
    "announcements_channel_id" TEXT
);
INSERT INTO "new_Degree" ("acronym", "name", "role_id", "tier") SELECT "acronym", "name", "role_id", "tier" FROM "Degree";
DROP TABLE "Degree";
ALTER TABLE "new_Degree" RENAME TO "Degree";
CREATE UNIQUE INDEX "Degree_acronym_key" ON "Degree"("acronym");
CREATE UNIQUE INDEX "Degree_name_key" ON "Degree"("name");
CREATE TABLE "new_Course" (
    "acronym" TEXT NOT NULL PRIMARY KEY,
    "display_acronym" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL
);
INSERT INTO "new_Course" ("acronym") SELECT "acronym" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_display_acronym_key" ON "Course"("display_acronym");
CREATE UNIQUE INDEX "Course_name_key" ON "Course"("name");
CREATE UNIQUE INDEX "Course_channel_id_key" ON "Course"("channel_id");
CREATE UNIQUE INDEX "Course_role_id_key" ON "Course"("role_id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
