import AdminHeader from "@/components/AdminHeader";

export default function Tasks() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div style={{ width: "100%", height: "calc(100vh - 64px)", overflow: "hidden" }}>
        <iframe
          src="https://melleka-marketing.notion.site/9e7cd72fe62c45149456-5f51cbcfe981?v=a4725534db1181b89822000cd7baabce"
          style={{ width: "100%", height: "100%", border: "none" }}
          allowFullScreen
        />
      </div>
    </div>
  );
}
