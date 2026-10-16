"use client";

// لو الـ root layout نفسه وقع: لازم html/body خاصين بيه، ومن غير CSS التطبيق (inline بس)
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "Cairo, Arial, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: 24 }}>
          <h2 style={{ margin: "0 0 8px" }}>حدث خطأ في المنظومة</h2>
          <p style={{ margin: 0 }}>يرجى تحديث الصفحة، وفي حال استمرار المشكلة يرجى إبلاغ مكتب إدارة المشروعات (PMO).</p>
          {error.digest && <p style={{ fontSize: 12, opacity: 0.7 }}>رمز الخطأ: {error.digest}</p>}
          <button type="button" onClick={() => retry()} style={{ marginTop: 12, padding: "6px 16px", cursor: "pointer" }}>
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
