import AdminHeader from "@/components/AdminHeader";
import { ExternalLink } from "lucide-react";

const NOTION_URL = "https://melleka-marketing.notion.site/9e7cd72fe62c45149456-5f51cbcfe981?v=a4725534db1181b89822000cd7baabce";

const API_BASE = import.meta.env.PROD
  ? "https://api.teams.melleka.com"
  : "";

const PROXY_URL = `${API_BASE}/api/notion-proxy?url=${encodeURIComponent(NOTION_URL)}`;

export default function Tasks() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div style={{ position: "relative", width: "100%", height: "calc(100vh - 64px)" }}>
        <iframe
          src={PROXY_URL}
          style={{ width: "100%", height: "100%", border: "none" }}
          allowFullScreen
        />
        {/* Fallback link in corner */}
        <a
          href={NOTION_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 13,
            color: "white",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            borderRadius: 6,
            textDecoration: "none",
            zIndex: 10,
          }}
        >
          Open in Notion <ExternalLink style={{ width: 14, height: 14 }} />
        </a>
      </div>
    </div>
  );
}
