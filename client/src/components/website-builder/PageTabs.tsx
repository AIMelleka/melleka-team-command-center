import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WebsitePage } from "@/types/website";

interface PageTabsProps {
  pages: WebsitePage[];
  activeFilename: string;
  onSelectPage: (filename: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string, filename: string) => void;
}

export default function PageTabs({ pages, activeFilename, onSelectPage, onAddPage, onDeletePage }: PageTabsProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border bg-card/50 overflow-x-auto">
      {pages.map((page) => (
        <button
          key={page.id}
          onClick={() => onSelectPage(page.filename)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
            page.filename === activeFilename
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {page.title || page.filename}
          {!page.is_homepage && (
            <X
              className="h-3 w-3 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePage(page.id, page.filename);
              }}
            />
          )}
        </button>
      ))}
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onAddPage} title="Add page">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
