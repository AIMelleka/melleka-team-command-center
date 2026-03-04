import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Bot, Upload, FileCheck, History, Brain, 
  ArrowLeft, Loader2, CheckCircle2, XCircle,
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
      // Upload file to storage if it's not text-only
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

      // Create submission record
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

      // Trigger analysis
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-purple-200/60 mb-4">You need admin access to use the QA Bot.</p>
            <Button onClick={() => navigate("/login")} variant="outline">
              Login as Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-purple-300 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">QA Bot</h1>
                  <p className="text-sm text-purple-200/60">Premium Quality Assurance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger 
              value="analyze" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white"
            >
              <FileCheck className="h-4 w-4 mr-2" />
              Analyze
            </TabsTrigger>
            <TabsTrigger 
              value="history"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white"
            >
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger 
              value="improvements"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white"
            >
              <Brain className="h-4 w-4 mr-2" />
              Train AI
            </TabsTrigger>
          </TabsList>

          {/* Analyze Tab */}
          <TabsContent value="analyze" className="space-y-6">
            {/* Content Type Selection */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="h-5 w-5 text-purple-400" />
                  Select Content Type
                </CardTitle>
                <CardDescription className="text-purple-200/60">
                  Choose the type of content you want to quality check
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {CONTENT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        selectedType === type.id
                          ? "border-purple-500 bg-purple-500/20 text-white"
                          : "border-white/10 bg-white/5 text-purple-200/70 hover:border-purple-500/50 hover:bg-white/10"
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
      </main>
    </div>
  );
}
