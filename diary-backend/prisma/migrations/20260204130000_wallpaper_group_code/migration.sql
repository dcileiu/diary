-- 组编号：同批多张壁纸共用，4～6 位数字（存 VARCHAR(6)）
ALTER TABLE `wallpaper` ADD COLUMN `group_code` VARCHAR(6) NOT NULL DEFAULT '000000';

UPDATE `wallpaper`
SET `group_code` = LPAD(CAST(LEAST(`id`, 999999) AS CHAR), 6, '0');

ALTER TABLE `wallpaper` MODIFY `group_code` VARCHAR(6) NOT NULL;

CREATE INDEX `wallpaper_group_code_idx` ON `wallpaper`(`group_code`);
