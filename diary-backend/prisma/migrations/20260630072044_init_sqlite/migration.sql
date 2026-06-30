-- CreateTable
CREATE TABLE "admin_session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token_hash" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "user_agent" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    "last_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "wx_user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "open_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '记仇用户',
    "avatar" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "total_entry_count" INTEGER NOT NULL DEFAULT 0,
    "active_entry_count" INTEGER NOT NULL DEFAULT 0,
    "resolved_entry_count" INTEGER NOT NULL DEFAULT 0,
    "last_entry_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "diary_category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#E85D75',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "diary_tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#577590',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "diary_entry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "target_name" TEXT NOT NULL DEFAULT '',
    "target_relation" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "grievance_level" INTEGER NOT NULL DEFAULT 3,
    "emotion_level" INTEGER NOT NULL DEFAULT 3,
    "follow_up_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "happened_at" DATETIME NOT NULL,
    "settled_at" DATETIME,
    "last_follow_up_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "diary_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wx_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diary_entry_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "diary_category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "diary_entry_tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entry_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diary_entry_tag_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diary_entry_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "diary_tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "diary_entry_attachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entry_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL DEFAULT '',
    "file_type" TEXT NOT NULL DEFAULT 'image',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diary_entry_attachment_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diary_entry_attachment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wx_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "diary_entry_follow_up" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entry_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "content" TEXT NOT NULL,
    "emotion_delta" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "diary_entry_follow_up_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diary_entry_follow_up_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wx_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_session_token_hash_key" ON "admin_session"("token_hash");

-- CreateIndex
CREATE INDEX "admin_session_expires_at_idx" ON "admin_session"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "wx_user_open_id_key" ON "wx_user"("open_id");

-- CreateIndex
CREATE UNIQUE INDEX "wx_user_access_token_key" ON "wx_user"("access_token");

-- CreateIndex
CREATE INDEX "wx_user_created_at_idx" ON "wx_user"("created_at");

-- CreateIndex
CREATE INDEX "wx_user_last_entry_at_idx" ON "wx_user"("last_entry_at");

-- CreateIndex
CREATE UNIQUE INDEX "diary_category_name_key" ON "diary_category"("name");

-- CreateIndex
CREATE INDEX "diary_category_sort_order_idx" ON "diary_category"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "diary_tag_name_key" ON "diary_tag"("name");

-- CreateIndex
CREATE INDEX "diary_tag_sort_order_idx" ON "diary_tag"("sort_order");

-- CreateIndex
CREATE INDEX "diary_entry_user_id_status_happened_at_idx" ON "diary_entry"("user_id", "status", "happened_at");

-- CreateIndex
CREATE INDEX "diary_entry_category_id_happened_at_idx" ON "diary_entry"("category_id", "happened_at");

-- CreateIndex
CREATE INDEX "diary_entry_is_pinned_created_at_idx" ON "diary_entry"("is_pinned", "created_at");

-- CreateIndex
CREATE INDEX "diary_entry_last_follow_up_at_idx" ON "diary_entry"("last_follow_up_at");

-- CreateIndex
CREATE INDEX "diary_entry_tag_tag_id_idx" ON "diary_entry_tag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "diary_entry_tag_entry_id_tag_id_key" ON "diary_entry_tag"("entry_id", "tag_id");

-- CreateIndex
CREATE INDEX "diary_entry_attachment_entry_id_sort_order_idx" ON "diary_entry_attachment"("entry_id", "sort_order");

-- CreateIndex
CREATE INDEX "diary_entry_attachment_user_id_created_at_idx" ON "diary_entry_attachment"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "diary_entry_follow_up_entry_id_created_at_idx" ON "diary_entry_follow_up"("entry_id", "created_at");

-- CreateIndex
CREATE INDEX "diary_entry_follow_up_user_id_created_at_idx" ON "diary_entry_follow_up"("user_id", "created_at");
