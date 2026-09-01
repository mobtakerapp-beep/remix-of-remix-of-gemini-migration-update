import type { Database } from "@/integrations/supabase/types";

type SupabaseClient = ReturnType<
  typeof import("@supabase/supabase-js").createClient<Database>
>;

export type SubscriptionStatus = {
  plan: "free" | "monthly" | "yearly";
  status: "active" | "expired" | "cancelled" | "pending";
  generationsUsed: number;
  generationsLimit: number;
  canGenerate: boolean;
  teacherName: string;
  school: string;
  email: string;
  remainingToday: number;
};

/** الحد اليومي للناس العادية بقى 3 دروس بدل 1 */
const FREE_DAILY_LIMIT = 3;
const PAID_LIMIT = 999999; // رقم كبير عشان يبقى الحساب بلا حدود

function isSameDay(a: Date, b: Date) {
  // الكود القديم كان بيصفر العداد كل شهر، صلحته هنا عشان يصفر كل يوم بجد
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function getSubscriptionStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionStatus> {
  let [subResult, profileResult, userResult] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!subResult.data || !profileResult.data) {
    await supabase.rpc("bootstrap_account", { _user_id: userId });
    [subResult, profileResult] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);
  }

  const sub = subResult.data;
  const profile = profileResult.data;
  const email = userResult.data?.user?.email ?? "";

  // 👈 هنا استثناء مروة (الـ VIP) .. غيري الإيميل ده لإيميلك الحقيقي
  const isVIP = email === "uuxz272@gmail.com";

  const now = new Date();
  let plan: "free" | "monthly" | "yearly" = "free";
  let status: SubscriptionStatus["status"] = "active";
  let generationsUsed = 0;
  let generationsLimit = isVIP ? PAID_LIMIT : FREE_DAILY_LIMIT;
  let resetAt = now;

  if (sub) {
    plan = sub.plan as "free" | "monthly" | "yearly";
    status = sub.status as SubscriptionStatus["status"];
    generationsUsed = sub.generations_used ?? 0;
    resetAt = new Date(sub.reset_at ?? now.toISOString());

    // لو الإيميل بتاعك، خلي الباقة دايماً مدفوعة والحد مفتوح
    if (isVIP) {
      plan = "yearly";
      status = "active";
      generationsLimit = PAID_LIMIT;
    } else {
      // حساب الناس العادية
      if (plan !== "free" && sub.expires_at) {
        const expiry = new Date(sub.expires_at);
        if (expiry < now) {
          status = "expired";
          plan = "free";
          generationsLimit = FREE_DAILY_LIMIT;
        } else {
          generationsLimit = PAID_LIMIT;
        }
      } else if (plan === "free") {
        generationsLimit = FREE_DAILY_LIMIT;
      } else {
        generationsLimit = PAID_LIMIT;
      }
    }

    // تصفير العداد لو اليوم اتغير
    if (!isSameDay(resetAt, now)) {
      generationsUsed = 0;
      await supabase
        .from("subscriptions")
        .update({ generations_used: 0, reset_at: now.toISOString() })
        .eq("user_id", userId);
    }
  }

  const canGenerate = isVIP ? true : generationsUsed < generationsLimit;

  return {
    plan,
    status,
    generationsUsed,
    generationsLimit,
    canGenerate,
    teacherName: profile?.teacher_name ?? "",
    school: profile?.school ?? "",
    email,
    remainingToday: isVIP ? PAID_LIMIT : Math.max(0, generationsLimit - generationsUsed),
  };
}

export async function incrementGenerationUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub) return;

  const now = new Date();
  const resetAt = new Date(sub.reset_at ?? now.toISOString());
  const shouldReset = !isSameDay(resetAt, now);

  await supabase
    .from("subscriptions")
    .update({
      generations_used: shouldReset ? 1 : (sub.generations_used ?? 0) + 1,
      reset_at: shouldReset ? now.toISOString() : sub.reset_at,
    })
    .eq("user_id", userId);
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  teacherName: string,
  school: string,
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ teacher_name: teacherName, school })
    .eq("id", userId);
}
