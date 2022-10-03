-- CreateTable
CREATE TABLE "role_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "placeholder" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "role_group_options" (
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" TEXT NOT NULL PRIMARY KEY,
    "role_group_id" TEXT,
    FOREIGN KEY ("role_group_id") REFERENCES "role_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
