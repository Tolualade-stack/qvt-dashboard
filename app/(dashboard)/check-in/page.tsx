import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkedInToday, loadMyWork } from "@/lib/work";
import { currentTime, formatDateTime } from "@/lib/format";
import { CheckInForm } from "./check-in-form";

export const metadata: Metadata = { title: "Check in · PRIME" };

export default async function CheckInPage() {
  const me = (await getCurrentUser())!;
  const supabase = await createClient();
  const now = currentTime();
  const [{ items }, alreadyDone] = await Promise.all([loadMyWork(supabase, me), checkedInToday(supabase, me, now)]);
  return (
    <CheckInForm
      name={me.name}
      alreadyDone={alreadyDone}
      time={formatDateTime(new Date(now))}
      next={items.slice(0, 3).map((i) => ({ title: i.title, due: i.dueLabel }))}
    />
  );
}
