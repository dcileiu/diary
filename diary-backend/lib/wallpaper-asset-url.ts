import { absoluteAssetUrl } from "@/lib/local-upload";

type WallpaperRowLike = { fileName?: string | null };

export type WallpaperWithAssetUrls<T> = T & {
  img: string;
  imgFull: string;
};

export function withWallpaperAssetUrls<T extends WallpaperRowLike>(
  req: Request,
  item: T,
): WallpaperWithAssetUrls<T> {
  const fileName = String(item.fileName || "").trim();
  if (!fileName) {
    return { ...item, img: "", imgFull: "" };
  }
  const encoded = encodeURIComponent(fileName);
  const imgFull = absoluteAssetUrl(req, `/uploads/wallpapers/${encoded}`);
  const img = `${imgFull}?imageView2/2/w/360/q/72/format/webp`;
  return { ...item, img, imgFull };
}

