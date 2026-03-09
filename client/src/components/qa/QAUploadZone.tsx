import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileUp, Loader2, FileText } from "lucide-react";

interface QAUploadZoneProps {
  contentType: string;
  accept: string;
  onFileSelect: (file: File, textContent?: string) => void;
  isAnalyzing: boolean;
}

export function QAUploadZone({ contentType, accept, onFileSelect, isAnalyzing }: QAUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const processFile = async (file: File) => {
    // For text-based files, read the content
    if (file.type.startsWith("text/") || 
        file.name.endsWith(".txt") || 
        file.name.endsWith(".md") ||
        file.name.endsWith(".html")) {
      const text = await file.text();
      onFileSelect(file, text);
    } else {
      onFileSelect(file);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    
    // Create a fake file for text content
    const blob = new Blob([textInput], { type: "text/plain" });
    const file = new File([blob], `${contentType}-content.txt`, { type: "text/plain" });
    onFileSelect(file, textInput);
  };

  const isTextType = ["ad_copy", "email", "text_campaign", "ugc_script"].includes(contentType);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Upload Content
          </span>
          {isTextType && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={inputMode === "file" ? "default" : "outline"}
                onClick={() => setInputMode("file")}
                className={inputMode === "file" ? "bg-purple-600" : "border-border text-muted-foreground"}
              >
                File
              </Button>
              <Button
                size="sm"
                variant={inputMode === "text" ? "default" : "outline"}
                onClick={() => setInputMode("text")}
                className={inputMode === "text" ? "bg-purple-600" : "border-border text-muted-foreground"}
              >
                Paste Text
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Analyzing Content...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Our AI is reviewing every detail for premium quality
            </p>
          </div>
        ) : inputMode === "text" && isTextType ? (
          <div className="space-y-4">
            <Textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                contentType === "email" 
                  ? "Paste your email content here (include subject line)..."
                  : contentType === "text_campaign"
                  ? "Paste your SMS/text message here..."
                  : contentType === "ugc_script"
                  ? "Paste your UGC script here (include speaker directions, timing, hooks, and talking points)..."
                  : "Paste your ad copy here..."
              }
              className="min-h-[200px] bg-muted/30 border-border"
            />
            <Button
              onClick={handleTextSubmit}
              disabled={!textInput.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              <FileText className="h-4 w-4 mr-2" />
              Analyze Content
            </Button>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input
              type="file"
              accept={accept}
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">
              Drop your file here or click to upload
            </p>
            <p className="text-sm text-muted-foreground">
              Supports: {accept}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
