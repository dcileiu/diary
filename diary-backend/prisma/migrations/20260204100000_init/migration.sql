-- CreateTable
CREATE TABLE `wx_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `open_id` VARCHAR(64) NOT NULL,
    `access_token` VARCHAR(128) NOT NULL,
    `nickname` VARCHAR(255) NOT NULL,
    `avatar` VARCHAR(512) NOT NULL,
    `color` VARCHAR(32) NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `is_vip` VARCHAR(8) NOT NULL,

    UNIQUE INDEX `wx_user_open_id_key`(`open_id`),
    UNIQUE INDEX `wx_user_access_token_key`(`access_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallpaper` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `file_name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `title` VARCHAR(255) NULL,
    `tags` VARCHAR(512) NULL,
    `color` VARCHAR(32) NULL,
    `hot_score` INTEGER NOT NULL DEFAULT 0,
    `downloading` INTEGER NOT NULL DEFAULT 0,
    `avatar_list` JSON NULL,

    INDEX `wallpaper_type_idx`(`type`),
    INDEX `wallpaper_hot_score_idx`(`hot_score`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_collection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `wallpaper_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_collection_user_id_idx`(`user_id`),
    UNIQUE INDEX `user_collection_user_id_wallpaper_id_key`(`user_id`, `wallpaper_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_download_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `wallpaper_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_download_log_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_record` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `content` VARCHAR(255) NOT NULL,
    `points` INTEGER NOT NULL,
    `type` VARCHAR(16) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `point_record_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_collection` ADD CONSTRAINT `user_collection_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `wx_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_collection` ADD CONSTRAINT `user_collection_wallpaper_id_fkey` FOREIGN KEY (`wallpaper_id`) REFERENCES `wallpaper`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_download_log` ADD CONSTRAINT `user_download_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `wx_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_download_log` ADD CONSTRAINT `user_download_log_wallpaper_id_fkey` FOREIGN KEY (`wallpaper_id`) REFERENCES `wallpaper`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_record` ADD CONSTRAINT `point_record_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `wx_user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
