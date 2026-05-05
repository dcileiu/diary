-- =============================================================================
-- 迁移：把壁纸相关字段里「旧站点/完整 URL」整理成可与 CDN 配合的数据形态
-- =============================================================================
--
-- 说明（请先读完再执行）：
-- 1）本项目的「收藏」表 user_collection 只存 wallpaper_id，不存图片 URL。
--    小程序/后台的图片地址 = assetBase（PUBLIC_ASSET_ORIGIN） + 固定路径 + file_name。
--    因此收藏列表无需单独改 URL；修好 wallpaper.file_name / avatar_list 即可。
-- 2）若历史数据把 file_name 存成了「整段 https 域名 + /uploads/wallpapers/xxx.jpg」
--    或带 /uploads/... 的路径，会导致与代码拼接重复，出现错误地址。
--    下面将把 file_name 规范为「仅文件名」如 xxx.jpg。
-- 3）头像组图 avatar_list（JSON 数组）里如果出现旧域名的绝对 URL，可批量替换为 CDN 域名。
--
-- 使用前：请先 mysqldump 备份；把下面 @OLD_HTTP_ORIGIN / @OLD_HTTPS_ORIGIN / @CDN_ORIGIN
-- 改成你自己的旧站与七牛 CDN 根（不要末尾斜杠）。
-- =============================================================================

SET NAMES utf8mb4;

-- 旧站 API/站点根（历史上图片若用该域名访问过，填这里；没有可保持为空串）
SET @OLD_HTTP_ORIGIN  = '';  -- 例: 'http://123.456.789.10:3010'
SET @OLD_HTTPS_ORIGIN = '';  -- 例: 'https://api.yoursite.com'
-- CDN / 对象存储访问根（与 .env 里 PUBLIC_ASSET_ORIGIN 一致，不要末尾 /）
SET @CDN_ORIGIN = 'https://你的七牛绑定域名'; -- 必填：实际执行时请改成真实 CDN

START TRANSACTION;

-- ---------------------------------------------------------------------------
-- A) wallpaper.file_name：去掉查询串；若含路径或 URL，只保留最后一段文件名
-- ---------------------------------------------------------------------------
UPDATE `wallpaper`
SET `file_name` = SUBSTRING_INDEX(`file_name`, '?', 1)
WHERE `file_name` LIKE '%?%';

UPDATE `wallpaper`
SET `file_name` = SUBSTRING_INDEX(`file_name`, '/', -1)
WHERE `file_name` LIKE '%/%';

-- 去掉首尾万一存在的空格
UPDATE `wallpaper`
SET `file_name` = TRIM(`file_name`)
WHERE `file_name` <> TRIM(`file_name`);

-- ---------------------------------------------------------------------------
-- B) wallpaper.avatar_list：JSON 数组里的旧域名绝对 URL -> CDN（分段替换，避免空串误伤）
--    若全是相对路径 /uploads/...，通常不必跑 B，列表展示会由 assetBase 拼 CDN。
-- ---------------------------------------------------------------------------
UPDATE `wallpaper`
SET `avatar_list` = CAST(
    REPLACE(CAST(`avatar_list` AS CHAR CHARSET utf8mb4), @OLD_HTTP_ORIGIN, @CDN_ORIGIN) AS JSON
  )
WHERE @OLD_HTTP_ORIGIN <> ''
  AND `avatar_list` IS NOT NULL
  AND JSON_TYPE(`avatar_list`) = 'ARRAY'
  AND CAST(`avatar_list` AS CHAR CHARSET utf8mb4) LIKE CONCAT('%', @OLD_HTTP_ORIGIN, '%');

UPDATE `wallpaper`
SET `avatar_list` = CAST(
    REPLACE(CAST(`avatar_list` AS CHAR CHARSET utf8mb4), @OLD_HTTPS_ORIGIN, @CDN_ORIGIN) AS JSON
  )
WHERE @OLD_HTTPS_ORIGIN <> ''
  AND `avatar_list` IS NOT NULL
  AND JSON_TYPE(`avatar_list`) = 'ARRAY'
  AND CAST(`avatar_list` AS CHAR CHARSET utf8mb4) LIKE CONCAT('%', @OLD_HTTPS_ORIGIN, '%');

COMMIT;

-- ---------------------------------------------------------------------------
-- 可选：统一把头图里的 /uploads/ 相对路径前面拼上 CDN（仅当历史误存成「无域名路径」
-- 且你希望库里也写成绝对地址时）。一般不需要：前端已用 assetBase 拼接。
-- ---------------------------------------------------------------------------
-- UPDATE wallpaper
-- SET avatar_list = ...  -- 视具体 JSON 结构而定，建议在应用里用脚本处理更安全
