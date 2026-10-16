"use client";

import { RotateCw } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { requeueAction } from "../emails.actions";

export function RequeueButton({ ids, label }: { ids: string[] | "allFailed"; label: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await requeueAction(ids);
          toast.show(r.message ?? "", r.ok ? "ok" : "err");
        })
      }
    >
      <RotateCw /> {label}
    </Button>
  );
}
