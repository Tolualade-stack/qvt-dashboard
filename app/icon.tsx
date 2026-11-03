import { appIcon } from "@/lib/app-icon";

// The small icon shown in browser tabs.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return appIcon(size.width);
}
