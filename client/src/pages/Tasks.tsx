import AdminHeader from "@/components/AdminHeader";

export default function Tasks() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader />
      <div className="flex-1 flex flex-col px-6 py-4">
        <iframe
          src="https://mellekamarketing.notion.site/ebd//9e7cd72fe62c451494565f51cbcfe981?v=26ab39641fb88055b7db000cfcbbbdb9"
          className="w-full flex-1 rounded-lg border border-border"
          style={{ minHeight: "calc(100vh - 100px)" }}
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </div>
  );
}
