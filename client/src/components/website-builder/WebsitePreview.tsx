import { useRef, useEffect, useState } from "react";
import { Monitor, Tablet, Smartphone, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeviceSize = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceSize, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

interface WebsitePreviewProps {
  htmlContent: string;
  className?: string;
}

export default function WebsitePreview({ htmlContent, className = "" }: WebsitePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>("desktop");
  const [key, setKey] = useState(0);

  useEffect(() => {
    // Debounce preview updates during rapid changes
    const timer = setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.srcdoc = htmlContent;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [htmlContent]);

  const openInNewTab = () => {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const hasContent = htmlContent.trim().length > 0;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-1">
          <Button
            variant={deviceSize === "desktop" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setDeviceSize("desktop")}
            title="Desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={deviceSize === "tablet" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setDeviceSize("tablet")}
            title="Tablet"
          >
            <Tablet className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={deviceSize === "mobile" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setDeviceSize("mobile")}
            title="Mobile"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setKey(k => k + 1)} title="Refresh">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          {hasContent && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openInNewTab} title="Open in new tab">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-muted/30 flex items-start justify-center overflow-auto p-4">
        {hasContent ? (
          <div
            className="bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300"
            style={{
              width: DEVICE_WIDTHS[deviceSize],
              maxWidth: "100%",
              height: deviceSize === "desktop" ? "100%" : "auto",
              minHeight: deviceSize === "desktop" ? "100%" : "600px",
            }}
          >
            <iframe
              key={key}
              ref={iframeRef}
              srcDoc={htmlContent}
              className="w-full h-full border-0"
              title="Website Preview"
              sandbox="allow-scripts allow-same-origin"
              style={{ minHeight: deviceSize === "desktop" ? "100%" : "600px" }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Monitor className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Live Preview</p>
            <p className="text-sm mt-1">Describe your website in the chat to see it here</p>
          </div>
        )}
      </div>
    </div>
  );
}
