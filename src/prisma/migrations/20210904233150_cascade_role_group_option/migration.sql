-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_role_group_options" (
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" TEXT NOT NULL PRIMARY KEY,
    "emoji" TEXT,
    "role_group_id" TEXT,
    FOREIGN KEY ("role_group_id") REFERENCES "role_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_role_group_options" ("description", "emoji", "label", "role_group_id", "value") SELECT "description", "emoji", "label", "role_group_id", "value" FROM "role_group_options";
DROP TABLE "role_group_options";
ALTER TABLE "new_role_group_options" RENAME TO "role_group_options";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
