import { appIcon } from "@/lib/app-icon";

// Icons listed in the app manifest (app/manifest.ts): /app-icon/192 and /app-icon/512.
const SIZES = [192, 512];

export async function GET(_request: Request, { params }: RouteContext<"/app-icon/[size]">) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  return appIcon(size);
}
