"use client";

import { ErrorView } from "@/components/shell/error-view";

export default function RootError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="p-4">
      <ErrorView {...props} />
    </div>
  );
}
