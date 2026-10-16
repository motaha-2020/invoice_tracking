/**
 * أنواع معالج المستخلص الجديد — client-safe (أرقام عادية، من غير Decimal ولا Date).
 */

export type ContractOption = {
  id: string;
  contractNo: string;
  title: string;
  aos: { id: string; aoNo: string; name: string; project: string | null; pending: boolean }[];
};

export type WorkTypeOption = { id: string; name: string; isPlanning: boolean };

export type AoWorkspace = {
  ao: {
    id: string;
    aoNo: string;
    name: string;
    pending: boolean;
    /** قيمة أمر التكليف (أو قيمة الكميات المخططة لو مش مسجلة) */
    value: number;
    financialCommitment: number | null;
    contractId: string;
    contractNo: string;
  };
  org: { presidency: string; sector: string; generalDept: string; dept: string; central: string; projectType: string; project: string };
  terms: { vatPct: number; payMonthlyPct: number; payAsbuiltPct: number; payHandoverPct: number; planningPayPct: number; taxPct: number | null };
  items: { id: string; itemNo: string; isGroup: boolean; description: string; unit: string | null; unitPrice: number | null; workType: string | null }[];
  /** الكمية المخططة لكل بند عقد في أمر التكليف */
  planned: Record<string, number>;
  /** المعتمد سابقاً لكل بند (المفتاح id البند، أو new:رقم) */
  prev: Record<string, { qty: number; value: number }>;
  sites: { code: string; name: string | null }[];
  catalog: { id: string; code: string; description: string; unit: string }[];
  matPlanned: Record<string, number>;
  matIssued: Record<string, number>;
  matPrev: Record<string, number>;
  requiredDocs: { id: string; name: string }[];
  docTypes: { id: string; name: string }[];
  /** المفوتر قبل كده على أمر التكليف (المستخلصات المقدمة) */
  billed: number;
  billedCount: number;
};

export type LineRowState = { code: string; qty: string | number; site?: string; manual?: boolean };
export type MaterialRowState = { code: string; qty: string | number };

export type DraftAttachment = { id: string; fileName: string; size: number; uploadedAt: string; docTypeId: string | null };

export type DraftState = {
  draftId: string | null;
  contractId: string;
  aoId: string;
  invoiceNo: string;
  pathName: string;
  period: string;
  workTypeId: string;
  siteCode: string;
  lines: LineRowState[];
  linesSource: "" | "excel" | "manual" | "draft";
  linesFile: string;
  materials: MaterialRowState[];
  materialsSource: "" | "excel" | "draft";
  materialsFile: string;
  attachments: DraftAttachment[];
};

export type DraftPayload = Pick<DraftState, "draftId" | "aoId" | "invoiceNo" | "pathName" | "period" | "workTypeId" | "siteCode"> & {
  lines: { code: string; qty: string | number; site?: string; manual?: boolean }[];
  materials: { code: string; qty: string | number }[];
};
