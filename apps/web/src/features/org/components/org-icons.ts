import { Briefcase, Building, Building2, FolderKanban, Landmark, Layers, RadioTower, Wrench, type LucideIcon } from "lucide-react";
import type { OrgKind } from "../org.kinds";

export const KIND_ICONS: Record<OrgKind, LucideIcon> = {
  presidency: Landmark,
  sector: Building2,
  techUnit: Wrench,
  generalDept: Building,
  dept: Briefcase,
  central: RadioTower,
  projectType: Layers,
  project: FolderKanban,
  company: Briefcase,
};
