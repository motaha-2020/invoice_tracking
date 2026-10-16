"use client";

import { ArrowLeft, ArrowRight, Check, CloudUpload, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert, Button, CategoryBadge, Money, Num } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { discardDraftAction, loadAoWorkspaceAction, saveDraftAction, submitDraftAction } from "../../draft.actions";
import { draftBlockers, previewDraft } from "../../draft-preview";
import type { AoWorkspace, ContractOption, DraftState, WorkTypeOption } from "../../draft.types";
import { StepBasics } from "./step-basics";
import { StepFiles } from "./step-files";
import { StepLines } from "./step-lines";
import { StepMaterials } from "./step-materials";

const STEPS = ["بيانات المستخلص", "بنود الأعمال", "المهمات", "المرفقات والمراجعة"];

function emptyDraft(contracts: ContractOption[], workTypes: WorkTypeOption[], period: string): DraftState {
  return {
    draftId: null,
    contractId: contracts.length === 1 ? contracts[0]!.id : "",
    aoId: "",
    invoiceNo: "",
    pathName: "",
    period,
    workTypeId: workTypes[0]?.id ?? "",
    siteCode: "",
    lines: [],
    linesSource: "",
    linesFile: "",
    materials: [],
    materialsSource: "",
    materialsFile: "",
    attachments: [],
  };
}

type Props = { contracts: ContractOption[]; workTypes: WorkTypeOption[]; initial: DraftState | null; defaultPeriod: string };

/** معالج تقديم مستخلص جديد في 4 خطوات — المعاينة والحسابات فورية بنفس دوال السيرفر (@it/domain) */
export function NewInvoiceWizard({ contracts, workTypes, initial, defaultPeriod }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [d, setD] = useState<DraftState>(initial ?? emptyDraft(contracts, workTypes, defaultPeriod));
  const [step, setStep] = useState(1);
  const [tried, setTried] = useState<Record<number, boolean>>({});
  // بيانات أمر التكليف المحمّلة (مرتبطة بالـ id عشان لو اتغير ما نستخدمش داتا قديمة)
  const [loaded, setLoaded] = useState<{ aoId: string; ws: AoWorkspace | null; error?: string } | null>(null);
  const ws = loaded && loaded.aoId === d.aoId ? loaded.ws : null;
  const wsError = loaded && loaded.aoId === d.aoId ? loaded.error : undefined;
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<DraftState>) => setD((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (!d.aoId) return;
    let live = true;
    loadAoWorkspaceAction(d.aoId, d.draftId).then((r) => {
      if (live) setLoaded(r.ok ? { aoId: d.aoId, ws: r.data } : { aoId: d.aoId, ws: null, error: r.message });
    });
    return () => {
      live = false;
    };
    // المسودة نفسها مش بتغيّر أرقام أمر التكليف — بنعيد التحميل لما أمر التكليف يتغير بس
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.aoId]);

  const isPlanning = workTypes.find((w) => w.id === d.workTypeId)?.isPlanning ?? false;
  const preview = useMemo(
    () => (ws ? previewDraft(ws, d.lines, d.materials, { defaultSite: d.siteCode || null, isPlanning }) : null),
    [ws, d.lines, d.materials, d.siteCode, isPlanning],
  );
  const attached = useMemo(() => new Set(d.attachments.map((a) => a.docTypeId).filter((x): x is string => !!x)), [d.attachments]);
  const blockers = draftBlockers(d, preview, ws?.requiredDocs ?? [], attached);
  const stepBlockers = (n: number) => blockers.filter((b) => b.step === n);

  const payload = () => ({
    draftId: d.draftId,
    aoId: d.aoId,
    invoiceNo: d.invoiceNo,
    pathName: d.pathName,
    period: d.period,
    workTypeId: d.workTypeId,
    siteCode: d.siteCode,
    lines: d.lines.map((l) => ({ code: l.code, qty: l.qty, site: l.site, manual: l.manual })),
    materials: d.materials,
  });

  const save = (after?: (draftId: string) => void, quiet = false) =>
    start(async () => {
      const r = await saveDraftAction(payload());
      if (!r.ok) {
        toast.show(r.message, "err");
        return;
      }
      setD((x) => ({ ...x, draftId: r.data.draftId }));
      setSavedAt(new Date());
      if (!quiet) toast.show(r.message ?? "تم حفظ المسودة", "ok");
      // الرابط يشاور على المسودة (لو الصفحة اتقفلت) من غير تنقل يعيد تحميل المعالج
      if (!d.draftId) window.history.replaceState(null, "", `/invoices/new?draft=${r.data.draftId}`);
      after?.(r.data.draftId);
    });

  const next = () => {
    const errs = stepBlockers(step);
    if (errs.length) {
      setTried((t) => ({ ...t, [step]: true }));
      toast.show(errs[0]!.text, "err");
      return;
    }
    save(() => {
      setStep((s) => Math.min(4, s + 1));
      window.scrollTo(0, 0);
    }, true);
  };

  const submit = () => {
    if (blockers.length) {
      setTried((t) => ({ ...t, 4: true }));
      toast.show("يرجى استكمال المتطلبات قبل التقديم", "err");
      return;
    }
    start(async () => {
      const s = await saveDraftAction(payload());
      if (!s.ok) return toast.show(s.message, "err");
      const r = await submitDraftAction(s.data.draftId);
      if (!r.ok) return toast.show(r.message, "err");
      toast.show(r.message ?? "تم تقديم المستخلص", "ok");
      router.push(`/invoices/${r.data.invoiceId}`);
    });
  };

  const discard = () => {
    if (!d.draftId || !confirm("هل تريد حذف المسودة نهائياً؟")) return;
    start(async () => {
      const r = await discardDraftAction(d.draftId!);
      toast.show(r.message ?? "", r.ok ? "ok" : "err");
      if (r.ok) router.push("/invoices/new");
    });
  };

  if (!contracts.length) {
    return <Alert tone="a" title="لا توجد عقود مسجلة لشركتكم">يرجى التواصل مع الشئون الفنية لاستيراد العقد وأوامر التكليف.</Alert>;
  }

  return (
    <>
      <ol aria-label="خطوات المستخلص" className="m-0 mb-5 flex list-none flex-wrap gap-2 p-0">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          return (
            <li key={label} className="min-w-[150px] flex-1">
              <button
                type="button"
                disabled={!done}
                aria-current={n === step ? "step" : undefined}
                onClick={() => done && setStep(n)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-base border px-3 py-2 text-start text-[13px] font-semibold",
                  n === step ? "border-brand bg-brand-soft text-brand-tx" : done ? "cursor-pointer border-ok3 bg-ok1 text-ok7" : "border-bd2 bg-card text-tx3",
                )}
              >
                <span className={cn("grid size-6 place-items-center rounded-full text-xs", n === step ? "bg-brand text-white" : done ? "bg-ok6 text-white" : "bg-sunken")}>
                  {done ? <Check className="size-3.5" aria-hidden /> : <Num>{n}</Num>}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      {wsError && <Alert tone="r" className="mb-4">{wsError}</Alert>}

      {step === 1 && <StepBasics d={d} set={set} contracts={contracts} workTypes={workTypes} ws={ws} errors={tried[1] ? stepBlockers(1) : []} />}
      {step === 2 && <StepLines d={d} set={set} ws={ws} preview={preview} tried={!!tried[2]} />}
      {step === 3 && <StepMaterials d={d} set={set} preview={preview} tried={!!tried[3]} />}
      {step === 4 && ws && preview && (
        <StepFiles d={d} updateAttachments={(fn) => setD((x) => ({ ...x, attachments: fn(x.attachments) }))} ws={ws} preview={preview} blockers={blockers} goStep={setStep} workTypes={workTypes} />
      )}

      <div data-print="hide" className="sticky bottom-0 z-10 mt-5 flex flex-wrap items-center gap-2 rounded-md border border-bd1 bg-card px-4 py-3 shadow-raised">
        <div className="me-auto flex flex-wrap items-center gap-3 text-[13px] text-tx2">
          <span className="inline-flex items-center gap-1.5 text-xs text-tx3">
            <CloudUpload className="size-4" aria-hidden />
            {savedAt ? <>حُفظت المسودة الساعة <Num>{savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</Num></> : "تُحفظ المسودة تلقائياً عند الانتقال بين الخطوات"}
          </span>
          {preview && preview.lines.length > 0 && (
            <>
              <span>الإجمالي <Money>{formatMoney(preview.gross)}</Money> جنيه</span>
              <CategoryBadge suggested={preview.suggestion.category} />
            </>
          )}
        </div>
        {d.draftId && <Button variant="gh" size="sm" disabled={pending} onClick={discard}><Trash2 /> حذف المسودة</Button>}
        {step > 1 && <Button disabled={pending} onClick={() => setStep((s) => s - 1)}><ArrowRight /> السابق</Button>}
        <Button variant="gh" disabled={pending || !d.aoId || !d.invoiceNo.trim() || !d.workTypeId || !d.pathName.trim()} onClick={() => save()}><Save /> حفظ كمسودة</Button>
        {step < 4 ? (
          <Button variant="pr" disabled={pending} onClick={next}>التالي <ArrowLeft /></Button>
        ) : (
          <Button variant="pr" disabled={pending} aria-disabled={blockers.length > 0} onClick={submit}><Send /> تقديم المستخلص</Button>
        )}
        {!initial && step === 1 && !d.draftId && (
          <Button variant="gh" size="sm" icon aria-label="البدء من جديد" title="البدء من جديد" onClick={() => setD(emptyDraft(contracts, workTypes, defaultPeriod))}><RotateCcw /></Button>
        )}
      </div>
    </>
  );
}
