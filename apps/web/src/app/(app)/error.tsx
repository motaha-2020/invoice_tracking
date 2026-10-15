"use client";

import { ErrorView } from "@/components/shell/error-view";

// جوه الـ shell: الهيدر والقائمة بيفضلوا ظاهرين والخطأ مكان المحتوى بس
export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView {...props} />;
}
