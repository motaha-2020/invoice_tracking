import {
  FileBarChart,
  FilePlus2,
  Files,
  FileSignature,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Mail,
  Network,
  Package,
  Reply,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/features/shell/nav";

export const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  home: LayoutDashboard,
  inbox: Inbox,
  reply: Reply,
  "file-plus": FilePlus2,
  files: Files,
  reports: FileBarChart,
  mail: Mail,
  contracts: FileSignature,
  org: Network,
  package: Package,
  users: Users,
  workflow: GitBranch,
};
