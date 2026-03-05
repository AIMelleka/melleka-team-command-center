import { useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import { ExternalLink } from "lucide-react";

const NOTION_URL = "https://www.notion.so/melleka-marketing/9e7cd72fe62c45149456-5f51cbcfe981?v=a4725534db1181b89822000cd7baabce";

export default function Tasks() {
  // Auto-open Notion on first visit
  useEffect(() => {
    window.open(NOTION_URL, "_blank");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 120px)", gap: 20, textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 48 }}>📋</div>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.91)" }}>IN HOUSE TO-DO</h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", maxWidth: 400 }}>
          Your task board lives in Notion. Click below to open it.
        </p>
        <a
          href={NOTION_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            fontSize: 15,
            fontWeight: 500,
            color: "white",
            background: "#2383e2",
            borderRadius: 6,
            textDecoration: "none",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1b6ec2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#2383e2")}
        >
          Open in Notion <ExternalLink style={{ width: 16, height: 16 }} />
        </a>
      </div>
    </div>
  );
}
