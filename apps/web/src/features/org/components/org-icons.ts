import { Briefcase, Building, Building2, FolderKanban, Hammer, Landmark, Layers, RadioTower, Wrench, type LucideIcon } from "lucide-react";
import type { OrgKind } from "../org.kinds";

export const KIND_ICONS: Record<OrgKind, LucideIcon> = {
  presidency: Landmark,
  sector: Building2,
  techUnit: Wrench,
  generalDept: Building,
  dept: Briefcase,
  central: RadioTower,
  projectType: Layers,
  workType: Hammer,
  project: FolderKanban,
  company: Briefcase,
};
