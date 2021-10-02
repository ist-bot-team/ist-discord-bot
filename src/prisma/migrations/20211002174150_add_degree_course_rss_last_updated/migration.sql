-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DegreeCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "degreeFenixId" TEXT NOT NULL,
    "courseAcronym" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "announcementsFeedUrl" TEXT,
    "feedLastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DegreeCourse_degreeFenixId_fkey" FOREIGN KEY ("degreeFenixId") REFERENCES "Degree" ("fenix_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DegreeCourse_courseAcronym_fkey" FOREIGN KEY ("courseAcronym") REFERENCES "Course" ("acronym") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DegreeCourse" ("announcementsFeedUrl", "courseAcronym", "degreeFenixId", "id", "semester", "year") SELECT "announcementsFeedUrl", "courseAcronym", "degreeFenixId", "id", "semester", "year" FROM "DegreeCourse";
DROP TABLE "DegreeCourse";
ALTER TABLE "new_DegreeCourse" RENAME TO "DegreeCourse";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
