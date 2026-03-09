import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp } from "lucide-react";

interface QACriterion {
  name: string;
  score: number;
  weight: number;
  feedback: string;
}

interface QAResult {
  id: string;
  fileName: string;
  contentType: string;
  score: number;
  passed: boolean;
  analysis: {
    criteria: QACriterion[];
    summary: string;
    improvements: string[];
    overallScore: number;
  };
}

interface QAResultCardProps {
  result: QAResult;
}

function getScoreColor(score: number): string {
  if (score >= 95) return "text-green-400";
  if (score >= 85) return "text-yellow-400";
  if (score >= 70) return "text-orange-400";
  return "text-red-400";
}

function getProgressColor(score: number): string {
  if (score >= 95) return "bg-green-500";
  if (score >= 85) return "bg-yellow-500";
  if (score >= 70) return "bg-orange-500";
  return "bg-red-500";
}

export function QAResultCard({ result }: QAResultCardProps) {
  const { analysis, passed, score, fileName, contentType } = result;

  return (
    <Card className="overflow-hidden">
      {/* Header with Score */}
      <div className={`p-6 ${passed ? "bg-green-500/10" : "bg-red-500/10"} border-b border-border`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {passed ? (
              <div className="p-3 rounded-full bg-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
            ) : (
              <div className="p-3 rounded-full bg-red-500/20">
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold">
                {passed ? "Quality Approved" : "Needs Improvement"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {fileName} • {contentType.replace("_", " ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${getScoreColor(score)}`}>
              {score}
            </div>
            <p className="text-sm text-muted-foreground">out of 100</p>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Summary */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Summary
          </h4>
          <p>{analysis.summary}</p>
        </div>

        {/* Criteria Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Detailed Scores
          </h4>
          <div className="space-y-4">
            {analysis.criteria.map((criterion, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{criterion.name}</span>
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                      {criterion.weight}%
                    </Badge>
                  </div>
                  <span className={`font-bold ${getScoreColor(criterion.score)}`}>
                    {criterion.score}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${getProgressColor(criterion.score)}`}
                    style={{ width: `${criterion.score}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{criterion.feedback}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Improvements */}
        {analysis.improvements.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recommended Improvements
            </h4>
            <ul className="space-y-2">
              {analysis.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
