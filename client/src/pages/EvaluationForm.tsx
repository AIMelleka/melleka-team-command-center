import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Star, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import type { Employee, Evaluation } from "@/types";

export default function EvaluationForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const employeeId = searchParams.get("employeeId");
  const editId = searchParams.get("editId");

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [evaluationDate, setEvaluationDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [rating, setRating] = useState<number>(0);
  const [strengths, setStrengths] = useState("");
  const [areasForImprovement, setAreasForImprovement] = useState("");
  const [goals, setGoals] = useState("");
  const [comments, setComments] = useState("");

  // Linked employee_id (from URL or from edited eval)
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(employeeId);

  useEffect(() => {
    loadInitialData();
  }, [employeeId, editId]);

  const loadInitialData = async () => {
    setLoading(true);

    // If editing an existing evaluation
    if (editId) {
      const { data, error } = await (supabase
        .from("evaluations" as any)
        .select("*")
        .eq("id", editId)
        .single() as any);

      if (error || !data) {
        toast.error("Evaluation not found");
        navigate("/employees");
        return;
      }

      const eval_ = data as Evaluation;
      setEmployeeName(eval_.employee_name);
      setDepartment(eval_.department || "");
      setEvaluationDate(eval_.evaluation_date);
      setRating(eval_.rating || 0);
      setStrengths(eval_.strengths || "");
      setAreasForImprovement(eval_.areas_for_improvement || "");
      setGoals(eval_.goals || "");
      setComments(eval_.comments || "");
      setLinkedEmployeeId(eval_.employee_id);

      // Load linked employee if exists
      if (eval_.employee_id) {
        const { data: emp } = await (supabase
          .from("employees" as any)
          .select("*")
          .eq("id", eval_.employee_id)
          .single() as any);
        if (emp) setEmployee(emp as Employee);
      }
    }
    // If pre-filling from employee
    else if (employeeId) {
      const { data, error } = await (supabase
        .from("employees" as any)
        .select("*")
        .eq("id", employeeId)
        .single() as any);

      if (error || !data) {
        toast.error("Employee not found");
        navigate("/employees");
        return;
      }

      const emp = data as Employee;
      setEmployee(emp);
      setEmployeeName(emp.name);
      setDepartment(emp.department);
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }
    if (rating < 1 || rating > 5) {
      toast.error("Please select a rating (1-5)");
      return;
    }

    setSaving(true);

    const payload = {
      employee_id: linkedEmployeeId,
      evaluator_id: user!.id,
      employee_name: employeeName.trim(),
      department: department.trim() || null,
      evaluation_date: evaluationDate,
      rating,
      strengths: strengths.trim() || null,
      areas_for_improvement: areasForImprovement.trim() || null,
      goals: goals.trim() || null,
      comments: comments.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editId) {
      ({ error } = await (supabase
        .from("evaluations" as any)
        .update(payload)
        .eq("id", editId) as any));
    } else {
      ({ error } = await (supabase
        .from("evaluations" as any)
        .insert(payload) as any));
    }

    if (error) {
      toast.error("Failed to save evaluation");
    } else {
      toast.success(editId ? "Evaluation updated" : "Evaluation submitted");
      if (linkedEmployeeId) {
        navigate(`/employees/${linkedEmployeeId}`);
      } else {
        navigate("/employees");
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (linkedEmployeeId) navigate(`/employees/${linkedEmployeeId}`);
              else navigate("/employees");
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">
            {editId ? "Edit Evaluation" : "New Evaluation"}
          </h1>
          {employee && (
            <span className="text-sm text-muted-foreground">— {employee.name}</span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Employee Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eval-name">Employee Name *</Label>
                <Input
                  id="eval-name"
                  value={employeeName}
                  onChange={e => setEmployeeName(e.target.value)}
                  disabled={!!linkedEmployeeId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eval-dept">Department</Label>
                <Input
                  id="eval-dept"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  disabled={!!linkedEmployeeId}
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="eval-date">Evaluation Date *</Label>
              <Input
                id="eval-date"
                type="date"
                value={evaluationDate}
                onChange={e => setEvaluationDate(e.target.value)}
              />
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>Rating *</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i)}
                    className="p-1 transition-colors"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        i <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30 hover:text-muted-foreground/60"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Text fields */}
            <div className="space-y-2">
              <Label htmlFor="eval-strengths">Strengths</Label>
              <Textarea
                id="eval-strengths"
                placeholder="What does this employee excel at?"
                value={strengths}
                onChange={e => setStrengths(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eval-improve">Areas for Improvement</Label>
              <Textarea
                id="eval-improve"
                placeholder="Where can this employee improve?"
                value={areasForImprovement}
                onChange={e => setAreasForImprovement(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eval-goals">Goals</Label>
              <Textarea
                id="eval-goals"
                placeholder="Goals for the next review period..."
                value={goals}
                onChange={e => setGoals(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eval-comments">Interviewer's Comments</Label>
              <Textarea
                id="eval-comments"
                placeholder="Any other notes..."
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  if (linkedEmployeeId) navigate(`/employees/${linkedEmployeeId}`);
                  else navigate("/employees");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editId ? "Update Evaluation" : "Submit Evaluation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
