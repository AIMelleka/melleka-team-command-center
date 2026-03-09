import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  History, CheckCircle2, XCircle, Loader2, 
  Image, FileText, Mail, MessageSquare, Video, File,
  ChevronDown, ChevronUp, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TYPE_ICONS: Record<string, React.ElementType> = {
  image: Image,
  ad_copy: FileText,
  email: Mail,
  text_campaign: MessageSquare,
  video: Video,
  document: File,
};

interface QASubmission {
  id: string;
  created_at: string;
  content_type: string;
  file_name: string;
  score: number | null;
  passed: boolean | null;
  status: string;
  analysis: any;
}

export function QAHistoryList() {
  const [submissions, setSubmissions] = useState<QASubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("qa_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      console.error("Failed to fetch submissions:", error);
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("qa_submissions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setSubmissions(prev => prev.filter(s => s.id !== id));
      toast.success("Submission deleted");
    } catch (error: any) {
      toast.error("Failed to delete submission");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <History className="h-12 w-12 text-primary/50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No History Yet</h3>
          <p className="text-muted-foreground">
            Your QA submissions will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          QA History
          <Badge variant="outline" className="ml-2 border-border text-muted-foreground">
            {submissions.length} submissions
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {submissions.map((submission) => {
          const Icon = TYPE_ICONS[submission.content_type] || File;
          const isExpanded = expandedId === submission.id;

          return (
            <div
              key={submission.id}
              className="rounded-xl border border-border bg-muted/30 overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">
                      {submission.file_name || "Untitled"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(submission.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {submission.status === "completed" ? (
                    <>
                      {submission.passed ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Passed
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                      <span className={`font-bold ${
                        (submission.score || 0) >= 95 ? "text-green-400" :
                        (submission.score || 0) >= 85 ? "text-yellow-400" :
                        (submission.score || 0) >= 70 ? "text-orange-400" : "text-red-400"
                      }`}>
                        {submission.score}
                      </span>
                    </>
                  ) : submission.status === "analyzing" ? (
                    <Badge className="bg-primary/10 text-primary border-primary/50">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Analyzing
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                      {submission.status}
                    </Badge>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && submission.analysis && (
                <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Summary</h4>
                    <p className="text-sm">{submission.analysis.summary}</p>
                  </div>

                  {submission.analysis.improvements?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Improvements Needed</h4>
                      <ul className="space-y-1">
                        {submission.analysis.improvements.map((imp: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-yellow-400">•</span>
                            {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(submission.id);
                      }}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
