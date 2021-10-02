-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "acronym" TEXT NOT NULL PRIMARY KEY,
    "display_acronym" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_id" TEXT,
    "role_id" TEXT,
    "hideChannel" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Course" ("acronym", "channel_id", "display_acronym", "name", "role_id") SELECT "acronym", "channel_id", "display_acronym", "name", "role_id" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_display_acronym_key" ON "Course"("display_acronym");
CREATE UNIQUE INDEX "Course_name_key" ON "Course"("name");
CREATE UNIQUE INDEX "Course_channel_id_key" ON "Course"("channel_id");
CREATE UNIQUE INDEX "Course_role_id_key" ON "Course"("role_id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
