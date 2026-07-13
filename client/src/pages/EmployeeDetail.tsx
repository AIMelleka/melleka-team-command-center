import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, User, Briefcase, Calendar, Loader2, Plus, Star, Edit,
} from "lucide-react";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/dateUtils";
import type { Employee, Evaluation } from "@/types";

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);

    const [empRes, evalRes] = await Promise.all([
      supabase.from("employees" as any).select("*").eq("id", id!).single() as any,
      supabase.from("evaluations" as any).select("*").eq("employee_id", id!).order("evaluation_date", { ascending: false }) as any,
    ]);

    if (empRes.error) {
      toast.error("Employee not found");
      navigate("/employees");
      return;
    }

    setEmployee(empRes.data as Employee);
    setEvaluations((evalRes.data || []) as Evaluation[]);
    setLoading(false);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground text-sm">No rating</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`h-4 w-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/employees")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <User className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">{employee.name}</h1>
            <Badge variant="outline">{employee.department}</Badge>
          </div>
          <Button
            onClick={() => navigate(`/evaluate?employeeId=${employee.id}`)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Evaluation
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Employee Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Employee Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{employee.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{employee.department}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date of Hire</p>
                  <p className="font-medium">{safeFormatDate(employee.date_of_hire, "MMM d, yyyy")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Star className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Evaluations</p>
                  <p className="font-medium">{evaluations.length}</p>
                </div>
              </div>
            </div>
            {employee.job_description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Job Description</p>
                <p className="text-sm">{employee.job_description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evaluations List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Evaluation History</h2>
            <Badge variant="secondary">{evaluations.length}</Badge>
          </div>

          <div className="bg-card rounded-lg border overflow-hidden">
            {evaluations.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>No evaluations yet.</p>
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => navigate(`/evaluate?employeeId=${employee.id}`)}
                >
                  <Plus className="h-4 w-4" />
                  Create First Evaluation
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Strengths</TableHead>
                    <TableHead>Areas for Improvement</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map(evaluation => (
                    <TableRow key={evaluation.id}>
                      <TableCell className="font-medium">
                        {safeFormatDate(evaluation.evaluation_date, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{renderStars(evaluation.rating)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {evaluation.strengths || "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {evaluation.areas_for_improvement || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/evaluate?editId=${evaluation.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
