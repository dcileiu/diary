-- 壁纸元数据：标题、标签必填；移除颜色字段
UPDATE `wallpaper` SET `title` = '' WHERE `title` IS NULL;
UPDATE `wallpaper` SET `tags` = '' WHERE `tags` IS NULL;
ALTER TABLE `wallpaper` MODIFY `title` VARCHAR(255) NOT NULL;
ALTER TABLE `wallpaper` MODIFY `tags` VARCHAR(512) NOT NULL;
ALTER TABLE `wallpaper` DROP COLUMN `color`;
