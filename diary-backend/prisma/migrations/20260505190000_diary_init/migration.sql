CREATE TABLE `wx_user` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `open_id` VARCHAR(64) NOT NULL,
  `access_token` VARCHAR(128) NOT NULL,
  `nickname` VARCHAR(64) NOT NULL DEFAULT '记仇用户',
  `avatar` VARCHAR(512) NOT NULL DEFAULT '',
  `bio` VARCHAR(255) NOT NULL DEFAULT '',
  `total_entry_count` INTEGER NOT NULL DEFAULT 0,
  `active_entry_count` INTEGER NOT NULL DEFAULT 0,
  `resolved_entry_count` INTEGER NOT NULL DEFAULT 0,
  `last_entry_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `wx_user_open_id_key`(`open_id`),
  UNIQUE INDEX `wx_user_access_token_key`(`access_token`),
  INDEX `wx_user_created_at_idx`(`created_at`),
  INDEX `wx_user_last_entry_at_idx`(`last_entry_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `diary_category` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) NOT NULL DEFAULT '',
  `color` VARCHAR(16) NOT NULL DEFAULT '#E85D75',
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `diary_category_name_key`(`name`),
  INDEX `diary_category_sort_order_idx`(`sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `diary_tag` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `color` VARCHAR(16) NOT NULL DEFAULT '#577590',
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `diary_tag_name_key`(`name`),
  INDEX `diary_tag_sort_order_idx`(`sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `diary_entry` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `category_id` INTEGER NULL,
  `title` VARCHAR(120) NOT NULL,
  `content` TEXT NOT NULL,
  `target_name` VARCHAR(64) NOT NULL DEFAULT '',
  `target_relation` VARCHAR(64) NOT NULL DEFAULT '',
  `location` VARCHAR(128) NOT NULL DEFAULT '',
  `grievance_level` INTEGER NOT NULL DEFAULT 3,
  `emotion_level` INTEGER NOT NULL DEFAULT 3,
  `follow_up_count` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('OPEN', 'COOLING', 'RECONCILED', 'RELEASED', 'ARCHIVED') NOT NULL DEFAULT 'OPEN',
  `is_pinned` BOOLEAN NOT NULL DEFAULT false,
  `happened_at` DATETIME(3) NOT NULL,
  `settled_at` DATETIME(3) NULL,
  `last_follow_up_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `diary_entry_user_id_status_happened_at_idx`(`user_id`, `status`, `happened_at`),
  INDEX `diary_entry_category_id_happened_at_idx`(`category_id`, `happened_at`),
  INDEX `diary_entry_is_pinned_created_at_idx`(`is_pinned`, `created_at`),
  INDEX `diary_entry_last_follow_up_at_idx`(`last_follow_up_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `diary_entry_tag` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entry_id` INTEGER NOT NULL,
  `tag_id` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `diary_entry_tag_entry_id_tag_id_key`(`entry_id`, `tag_id`),
  INDEX `diary_entry_tag_tag_id_idx`(`tag_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `diary_entry_attachment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entry_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `file_url` VARCHAR(512) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL DEFAULT '',
  `file_type` VARCHAR(32) NOT NULL DEFAULT 'image',
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `diary_entry_attachment_entry_id_sort_order_idx`(`entry_id`, `sort_order`),
  INDEX `diary_entry_attachment_user_id_created_at_idx`(`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `diary_entry_follow_up` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entry_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `type` ENUM('NOTE', 'REFLECTION', 'ACTION', 'RESULT') NOT NULL DEFAULT 'NOTE',
  `content` TEXT NOT NULL,
  `emotion_delta` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `diary_entry_follow_up_entry_id_created_at_idx`(`entry_id`, `created_at`),
  INDEX `diary_entry_follow_up_user_id_created_at_idx`(`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `diary_entry`
  ADD CONSTRAINT `diary_entry_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `wx_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `diary_entry_category_id_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `diary_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `diary_entry_tag`
  ADD CONSTRAINT `diary_entry_tag_entry_id_fkey`
    FOREIGN KEY (`entry_id`) REFERENCES `diary_entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `diary_entry_tag_tag_id_fkey`
    FOREIGN KEY (`tag_id`) REFERENCES `diary_tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `diary_entry_attachment`
  ADD CONSTRAINT `diary_entry_attachment_entry_id_fkey`
    FOREIGN KEY (`entry_id`) REFERENCES `diary_entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `diary_entry_attachment_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `wx_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `diary_entry_follow_up`
  ADD CONSTRAINT `diary_entry_follow_up_entry_id_fkey`
    FOREIGN KEY (`entry_id`) REFERENCES `diary_entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `diary_entry_follow_up_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `wx_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
