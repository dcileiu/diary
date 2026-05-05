-- CreateTable
CREATE TABLE `wallpaper_category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wallpaper_category_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `wallpaper_category` (`name`, `sort_order`) VALUES
('手机壁纸', 0),
('头像', 1),
('电脑平板', 2),
('创意摄影', 3);
