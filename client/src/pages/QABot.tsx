import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bot, Upload, FileCheck, History, Brain,
  Loader2, XCircle,
  Image, FileText, Mail, MessageSquare, Video, File, Clapperboard
} from "lucide-react";
import { QAUploadZone } from "@/components/qa/QAUploadZone";
import { QAResultCard } from "@/components/qa/QAResultCard";
import { QAHistoryList } from "@/components/qa/QAHistoryList";
import { QAImprovementNotes } from "@/components/qa/QAImprovementNotes";

const CONTENT_TYPES = [
  { id: "image", label: "Image", icon: Image, accept: "image/*" },
  { id: "ad_copy", label: "Ad Copy", icon: FileText, accept: ".txt,.md" },
  { id: "email", label: "Email", icon: Mail, accept: ".txt,.html,.eml" },
  { id: "text_campaign", label: "SMS/Text", icon: MessageSquare, accept: ".txt" },
  { id: "ugc_script", label: "UGC Script", icon: Clapperboard, accept: ".txt,.md,.doc,.docx" },
  { id: "video", label: "Video", icon: Video, accept: "video/*" },
  { id: "document", label: "Document", icon: File, accept: ".pdf,.doc,.docx,.txt" },
];

export default function QABot() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("analyze");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<any>(null);

  const handleFileSelect = useCallback(async (file: File, textContent?: string) => {
    if (!selectedType) {
      toast.error("Please select a content type first");
      return;
    }

    setIsAnalyzing(true);
    setCurrentResult(null);

    try {
      let fileUrl: string | null = null;
      const fileName = file.name;

      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        const filePath = `${Date.now()}-${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("qa-uploads")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("qa-uploads")
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
      }

      const { data: submission, error: createError } = await supabase
        .from("qa_submissions")
        .insert({
          content_type: selectedType,
          file_name: fileName,
          file_url: fileUrl,
          raw_content: textContent || null,
          status: "pending",
        })
        .select()
        .single();

      if (createError) throw createError;

      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        "qa-analyze",
        {
          body: {
            submissionId: submission.id,
            contentType: selectedType,
            content: textContent || null,
            fileUrl,
            fileName,
          },
        }
      );

      if (analysisError) throw analysisError;

      setCurrentResult({
        ...analysisResult,
        id: submission.id,
        fileName,
        contentType: selectedType,
      });

      if (analysisResult.passed) {
        toast.success(`Content passed QA with score ${analysisResult.score}/100!`);
      } else {
        toast.warning(`Content scored ${analysisResult.score}/100 - needs improvement`);
      }
    } catch (error: any) {
      console.error("QA analysis error:", error);
      toast.error(error.message || "Failed to analyze content");
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedType]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">You need admin access to use the QA Bot.</p>
            <Button onClick={() => navigate("/login")} variant="outline">
              Login as Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl md:text-4xl font-bold">QA Bot</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Premium Quality Assurance
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="p-1">
              <TabsTrigger value="analyze">
                <FileCheck className="h-4 w-4 mr-2" />
                Analyze
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger value="improvements">
                <Brain className="h-4 w-4 mr-2" />
                Train AI
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Analyze Tab */}
          <TabsContent value="analyze" className="space-y-6">
            {/* Content Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Select Content Type
                </CardTitle>
                <CardDescription>
                  Choose the type of content you want to quality check
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                  {CONTENT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        selectedType === type.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <type.icon className="h-6 w-6" />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upload Zone */}
            {selectedType && (
              <QAUploadZone
                contentType={selectedType}
                accept={CONTENT_TYPES.find(t => t.id === selectedType)?.accept || "*"}
                onFileSelect={handleFileSelect}
                isAnalyzing={isAnalyzing}
              />
            )}

            {/* Current Result */}
            {currentResult && (
              <QAResultCard result={currentResult} />
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <QAHistoryList />
          </TabsContent>

          {/* Improvements Tab */}
          <TabsContent value="improvements">
            <QAImprovementNotes />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
