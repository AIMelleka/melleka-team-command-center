import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Plus, Trash2, Loader2, Search, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/dateUtils";
import type { Employee } from "@/types";

interface EmployeeWithCount extends Employee {
  evaluation_count: number;
}

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeWithCount | null>(null);
  const [saving, setSaving] = useState(false);

  // Add form state
  const [formName, setFormName] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formJobDescription, setFormJobDescription] = useState("");
  const [formDateOfHire, setFormDateOfHire] = useState("");

  useEffect(() => {
    if (user) fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    setLoading(true);
    // Fetch employees with evaluation count
    const { data: emps, error } = await (supabase
      .from("employees" as any)
      .select("*")
      .eq("team_lead_id", user!.id)
      .order("name", { ascending: true }) as any);

    if (error) {
      toast.error("Failed to load employees");
      setLoading(false);
      return;
    }

    // Get evaluation counts per employee
    const empList = (emps || []) as Employee[];
    if (empList.length === 0) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    const empIds = empList.map(e => e.id);
    const { data: evalCounts } = await (supabase
      .from("evaluations" as any)
      .select("employee_id")
      .in("employee_id", empIds) as any);

    const countMap: Record<string, number> = {};
    ((evalCounts || []) as { employee_id: string }[]).forEach(e => {
      countMap[e.employee_id] = (countMap[e.employee_id] || 0) + 1;
    });

    setEmployees(empList.map(e => ({
      ...e,
      evaluation_count: countMap[e.id] || 0,
    })));
    setLoading(false);
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = async () => {
    if (!formName.trim() || !formDepartment.trim()) {
      toast.error("Name and department are required");
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from("employees" as any).insert({
      team_lead_id: user!.id,
      name: formName.trim(),
      department: formDepartment.trim(),
      job_description: formJobDescription.trim() || null,
      date_of_hire: formDateOfHire || null,
    }) as any);

    if (error) {
      toast.error("Failed to add employee");
    } else {
      toast.success("Employee added");
      resetForm();
      setAddDialogOpen(false);
      fetchEmployees();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;
    setSaving(true);
    const { error } = await (supabase
      .from("employees" as any)
      .delete()
      .eq("id", employeeToDelete.id) as any);

    if (error) {
      toast.error("Failed to delete employee");
    } else {
      setEmployees(prev => prev.filter(e => e.id !== employeeToDelete.id));
      toast.success("Employee deleted");
    }
    setSaving(false);
    setDeleteDialogOpen(false);
    setEmployeeToDelete(null);
  };

  const resetForm = () => {
    setFormName("");
    setFormDepartment("");
    setFormJobDescription("");
    setFormDateOfHire("");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">My Employees</h1>
            <Badge variant="secondary">{employees.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/evaluate")} variant="outline" className="gap-2">
              New Evaluation
            </Button>
            <Button onClick={() => { resetForm(); setAddDialogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Employees</p>
            <p className="text-2xl font-bold">{employees.length}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Departments</p>
            <p className="text-2xl font-bold text-primary">
              {new Set(employees.map(e => e.department)).size}
            </p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Evaluations</p>
            <p className="text-2xl font-bold text-muted-foreground">
              {employees.reduce((sum, e) => sum + e.evaluation_count, 0)}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or department..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {searchQuery
                ? "No employees match your search."
                : "No employees yet. Click \"Add Employee\" to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Date of Hire</TableHead>
                  <TableHead className="text-right">Evaluations</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(employee => (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/employees/${employee.id}`)}
                  >
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{employee.department}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {safeFormatDate(employee.date_of_hire, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {employee.evaluation_count}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={e => {
                            e.stopPropagation();
                            setEmployeeToDelete(employee);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      {/* Add Employee Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="emp-name">Name *</Label>
              <Input
                id="emp-name"
                placeholder="Employee name"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-dept">Department *</Label>
              <Input
                id="emp-dept"
                placeholder="e.g. Marketing, Engineering"
                value={formDepartment}
                onChange={e => setFormDepartment(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-job">Job Description</Label>
              <Textarea
                id="emp-job"
                placeholder="Role and responsibilities..."
                value={formJobDescription}
                onChange={e => setFormJobDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-hire">Date of Hire</Label>
              <Input
                id="emp-hire"
                type="date"
                value={formDateOfHire}
                onChange={e => setFormDateOfHire(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{employeeToDelete?.name}"?
              {(employeeToDelete?.evaluation_count ?? 0) > 0 && (
                <span className="block mt-2 font-medium text-destructive">
                  This will also delete {employeeToDelete!.evaluation_count} evaluation{employeeToDelete!.evaluation_count !== 1 ? "s" : ""}.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
