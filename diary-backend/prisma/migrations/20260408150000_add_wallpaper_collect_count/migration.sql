-- Add collect_count to wallpaper for fast display.
ALTER TABLE `wallpaper`
  ADD COLUMN `collect_count` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `wallpaper_collect_count_idx` ON `wallpaper`(`collect_count`);

