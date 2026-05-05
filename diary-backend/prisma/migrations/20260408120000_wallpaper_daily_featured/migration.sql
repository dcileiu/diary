-- AlterTable
ALTER TABLE `wallpaper` ADD COLUMN `daily_featured` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `wallpaper` ADD COLUMN `daily_featured_sort` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `wallpaper_daily_featured_daily_featured_sort_idx` ON `wallpaper`(`daily_featured`, `daily_featured_sort`);
