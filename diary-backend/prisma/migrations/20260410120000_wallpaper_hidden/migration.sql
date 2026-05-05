-- 小程序侧仅展示 hidden = false 的壁纸；默认 false（显示）
ALTER TABLE `wallpaper` ADD COLUMN `hidden` BOOLEAN NOT NULL DEFAULT false;
