-- CreateTable
CREATE TABLE "config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cron" TEXT,
    "channel_id" TEXT NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_groups" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "placeholder" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "min_values" INTEGER,
    "max_values" INTEGER,
    "channel_id" TEXT NOT NULL,
    "message_id" TEXT,

    CONSTRAINT "role_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_group_options" (
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "emoji" TEXT,
    "role_group_id" TEXT NOT NULL,

    CONSTRAINT "role_group_options_pkey" PRIMARY KEY ("value")
);

-- CreateTable
CREATE TABLE "degrees" (
    "fenix_id" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "degree_text_channel_id" TEXT,
    "degree_voice_channel_id" TEXT,
    "announcements_channel_id" TEXT,
    "course_selection_channel_id" TEXT,

    CONSTRAINT "degrees_pkey" PRIMARY KEY ("fenix_id")
);

-- CreateTable
CREATE TABLE "courses" (
    "acronym" TEXT NOT NULL,
    "display_acronym" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_id" TEXT,
    "role_id" TEXT,
    "hide_channel" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("acronym")
);

-- CreateTable
CREATE TABLE "degree_courses" (
    "id" TEXT NOT NULL,
    "degree_fenix_id" TEXT NOT NULL,
    "course_acronym" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "announcements_feed_url" TEXT,
    "feed_last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "color" TEXT,

    CONSTRAINT "degree_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_role_selection_messages" (
    "injected_role_group_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,

    CONSTRAINT "course_role_selection_messages_pkey" PRIMARY KEY ("injected_role_group_id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "user_id" TEXT NOT NULL,
    "character_count" INTEGER NOT NULL,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "degrees_acronym_key" ON "degrees"("acronym");

-- CreateIndex
CREATE UNIQUE INDEX "degrees_name_key" ON "degrees"("name");

-- CreateIndex
CREATE UNIQUE INDEX "courses_display_acronym_key" ON "courses"("display_acronym");

-- CreateIndex
CREATE UNIQUE INDEX "courses_channel_id_key" ON "courses"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_role_id_key" ON "courses"("role_id");

-- AddForeignKey
ALTER TABLE "role_group_options" ADD CONSTRAINT "role_group_options_role_group_id_fkey" FOREIGN KEY ("role_group_id") REFERENCES "role_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_courses" ADD CONSTRAINT "degree_courses_course_acronym_fkey" FOREIGN KEY ("course_acronym") REFERENCES "courses"("acronym") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_courses" ADD CONSTRAINT "degree_courses_degree_fenix_id_fkey" FOREIGN KEY ("degree_fenix_id") REFERENCES "degrees"("fenix_id") ON DELETE CASCADE ON UPDATE CASCADE;
