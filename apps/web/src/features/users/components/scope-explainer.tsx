import type { Role } from "@it/db";
import { Alert, Badge, Card, CardHeader, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import type { Permission } from "@/features/auth/permission-rules";
import { ROLE_LABELS, SCOPE_TYPE_LABELS } from "@/lib/labels";
import { PERMISSION_LABELS, SCOPE_EXPLAIN } from "../users.labels";
import { ALL_ROLES, PERMISSION_KEYS, defaultScopeType } from "../users.rules";

type Props = { counts: Partial<Record<Role, number>>; matrix: Record<Permission, Role[]>; stepsByRole: Partial<Record<Role, string[]>> };

/** "مين يشوف إيه": لكل دور — نطاقه المعتاد، يعني إيه، بيعتمد في أنهي محطة، وصلاحياته الإضافية */
export function ScopeExplainer({ counts, matrix, stepsByRole }: Props) {
  return (
    <>
      <Alert tone="i" className="mb-3">
        كل مستخدم ليه <b>دور</b> (بيحدد يعمل إيه: يعتمد في أنهي محطة) و<b>نطاق</b> (بيحدد يشوف مستخلصات أنهي جهات). المسودات بتظهر للشركة
        صاحبتها بس، وأي مستخلص برّه النطاق مش بيظهر خالص — مش مجرد مستخبي من الشاشة.
      </Alert>
      <Card>
        <CardHeader title="النطاق حسب الدور" sub="النطاق المعتاد بيتحط أوتوماتيك لما تضيف المستخدم، وتقدر تغيّره" />
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr><Th>الدور</Th><Th>النطاق المعتاد</Th><Th>يشوف إيه</Th><Th>بيعتمد في</Th><Th>صلاحيات إضافية</Th><Th align="end">مستخدمين</Th></Tr>
            </THead>
            <TBody>
              {ALL_ROLES.map((r) => {
                const s = defaultScopeType(r);
                const perms = PERMISSION_KEYS.filter((p) => matrix[p].includes(r));
                return (
                  <Tr key={r}>
                    <Td><Badge tone="p">{ROLE_LABELS[r]}</Badge></Td>
                    <Td className="whitespace-nowrap">{SCOPE_TYPE_LABELS[s]}</Td>
                    <Td className="text-xs text-tx2">{SCOPE_EXPLAIN[s]}</Td>
                    <Td className="text-xs">{stepsByRole[r]?.join("، ") || <span className="text-tx3">—</span>}</Td>
                    <Td className="text-xs text-tx2">{perms.map((p) => PERMISSION_LABELS[p]).join("، ") || <span className="text-tx3">—</span>}</Td>
                    <Td align="end"><span className="num">{counts[r] ?? 0}</span></Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
