import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Home, Loader2, Trophy, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { listShareResults, type ShareWithResults } from "@/lib/shares.functions";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "نتائج الطلبة — مولّد الدروس الذكي" },
      { name: "description", content: "اعرض أسماء الطلبة الذين حلّوا دروسك ودرجاتهم وإجاباتهم." },
      { property: "og:title", content: "نتائج الطلبة" },
      { property: "og:description", content: "درجات الطلبة وإجاباتهم على الدروس المشتركة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const fetchResults = useServerFn(listShareResults);
  const [shares, setShares] = useState<ShareWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        setShares(await fetchResults({ data: undefined } as never));
      } catch {
        toast.error(ar ? "فشل تحميل النتائج" : "Failed to load results");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchResults, navigate, ar]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8" dir={ar ? "rtl" : "ltr"}>
      <Toaster position="top-center" />
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold text-primary">
            <Trophy className="me-2 inline size-6" />
            {ar ? "نتائج الطلبة" : "Student results"}
          </h1>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold"
          >
            <Home className="size-4" /> {ar ? "الرئيسية" : "Home"}
          </Link>
        </div>

        {shares.length === 0 && (
          <Card className="rounded-3xl p-8 text-center text-muted-foreground">
            {ar
              ? "لا توجد دروس مشتركة بعد. شاركي درسًا مع طلبتك وستظهر نتائجهم هنا."
              : "No shared lessons yet. Share a lesson and results will appear here."}
          </Card>
        )}

        {shares.map((s) => (
          <Card key={s.token} className="rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold">{s.title}</h2>
              <span className="text-xs text-muted-foreground">
                {new Date(s.createdAt).toLocaleDateString(ar ? "ar-EG" : "en-GB")} ·{" "}
                {ar ? `${s.results.length} طالب` : `${s.results.length} students`}
              </span>
            </div>

            {s.results.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {ar ? "لم يحلّ أحد هذا الدرس بعد." : "Nobody has played this lesson yet."}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {s.results.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-border p-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-start"
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                    >
                      <span className="font-semibold">{r.studentName}</span>
                      <span className="flex items-center gap-3 text-sm">
                        <span className="font-bold text-emerald">
                          {r.score} / {r.total}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString(ar ? "ar-EG" : "en-GB")}
                        </span>
                      </span>
                    </button>

                    {open === r.id && (
                      <ol className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                        {r.answers.map((a, i) => (
                          <li key={`${r.id}-${i}`} className="flex items-start gap-2">
                            {a.isCorrect ? (
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald" />
                            ) : (
                              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                            )}
                            <div>
                              <p className="font-medium">{a.prompt}</p>
                              <p className="text-muted-foreground">
                                {ar ? "إجابته:" : "Answer:"} {a.picked}
                                {!a.isCorrect && (
                                  <>
                                    {" — "}
                                    {ar ? "الصحيح:" : "Correct:"} {a.correct}
                                  </>
                                )}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
