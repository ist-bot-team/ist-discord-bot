-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_degree_courses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "degree_fenix_id" TEXT NOT NULL,
    "course_acronym" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "announcements_feed_url" TEXT,
    "feed_last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "degree_courses_degree_fenix_id_fkey" FOREIGN KEY ("degree_fenix_id") REFERENCES "degrees" ("fenix_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "degree_courses_course_acronym_fkey" FOREIGN KEY ("course_acronym") REFERENCES "courses" ("acronym") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_degree_courses" ("course_acronym", "degree_fenix_id", "id", "semester", "year") SELECT "course_acronym", "degree_fenix_id", "id", "semester", "year" FROM "degree_courses";
DROP TABLE "degree_courses";
ALTER TABLE "new_degree_courses" RENAME TO "degree_courses";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
