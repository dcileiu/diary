import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "public",
    "files",
    "icon",
    "link_remake_icon.png",
  );
  const buf = await readFile(filePath);
  return new Response(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

