import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Brain, Plus, Loader2, Trash2, Save, 
  Lightbulb, Image, FileText, Mail, MessageSquare, Video, File
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const CONTENT_TYPES = [
  { id: "all", label: "All Types", icon: Lightbulb },
  { id: "image", label: "Images", icon: Image },
  { id: "ad_copy", label: "Ad Copy", icon: FileText },
  { id: "email", label: "Emails", icon: Mail },
  { id: "text_campaign", label: "SMS/Text", icon: MessageSquare },
  { id: "video", label: "Videos", icon: Video },
  { id: "document", label: "Documents", icon: File },
];

interface ImprovementNote {
  id: string;
  created_at: string;
  content_type: string;
  note: string;
  priority: number;
  is_active: boolean;
}

export function QAImprovementNotes() {
  const [notes, setNotes] = useState<ImprovementNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New note form
  const [newNote, setNewNote] = useState("");
  const [newContentType, setNewContentType] = useState("all");
  const [newPriority, setNewPriority] = useState(5);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("qa_improvement_notes")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      console.error("Failed to fetch notes:", error);
      toast.error("Failed to load improvement notes");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error("Please enter a note");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("qa_improvement_notes")
        .insert({
          note: newNote.trim(),
          content_type: newContentType,
          priority: newPriority,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev].sort((a, b) => b.priority - a.priority));
      setNewNote("");
      setNewPriority(5);
      toast.success("Improvement note added! The AI will now consider this feedback.");
    } catch (error: any) {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("qa_improvement_notes")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;

      setNotes(prev => prev.map(n => n.id === id ? { ...n, is_active: isActive } : n));
      toast.success(isActive ? "Note activated" : "Note deactivated");
    } catch (error: any) {
      toast.error("Failed to update note");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("qa_improvement_notes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setNotes(prev => prev.filter(n => n.id !== id));
      toast.success("Note deleted");
    } catch (error: any) {
      toast.error("Failed to delete note");
    }
  };

  const getTypeIcon = (type: string) => {
    const found = CONTENT_TYPES.find(t => t.id === type);
    return found?.icon || Lightbulb;
  };

  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add New Note */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            Train the QA AI
          </CardTitle>
          <CardDescription className="text-purple-200/60">
            Add notes about what the AI should improve on. These will be injected into
            every QA analysis to continuously improve quality checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Example: Be stricter about headline length - they should be under 60 characters for SEO"
            className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
          />

          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-purple-200/70 text-sm">Content Type</Label>
              <Select value={newContentType} onValueChange={setNewContentType}>
                <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {CONTENT_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id} className="text-white">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-purple-200/70 text-sm">Priority (1-10)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={newPriority}
                onChange={(e) => setNewPriority(Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                className="w-24 bg-white/5 border-white/10 text-white"
              />
            </div>

            <Button
              onClick={handleAddNote}
              disabled={saving || !newNote.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Notes */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-purple-400" />
            Active Improvement Notes
            <Badge variant="outline" className="ml-2 border-white/20 text-purple-200/60">
              {notes.filter(n => n.is_active).length} active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-purple-400/50 mx-auto mb-4" />
              <p className="text-purple-200/60">
                No improvement notes yet. Add your first one above!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const Icon = getTypeIcon(note.content_type);
                return (
                  <div
                    key={note.id}
                    className={`p-4 rounded-xl border transition-all ${
                      note.is_active
                        ? "border-purple-500/30 bg-purple-500/10"
                        : "border-white/10 bg-white/5 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-lg bg-white/10">
                            <Icon className="h-3.5 w-3.5 text-purple-400" />
                          </div>
                          <Badge variant="outline" className="border-white/20 text-purple-200/60 text-xs">
                            {CONTENT_TYPES.find(t => t.id === note.content_type)?.label || note.content_type}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              note.priority >= 8 
                                ? "border-red-500/30 text-red-400" 
                                : note.priority >= 5 
                                ? "border-yellow-500/30 text-yellow-400"
                                : "border-white/20 text-purple-200/60"
                            }`}
                          >
                            Priority {note.priority}
                          </Badge>
                        </div>
                        <p className="text-white text-sm">{note.note}</p>
                        <p className="text-xs text-purple-200/40 mt-2">
                          Added {format(new Date(note.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={note.is_active}
                            onCheckedChange={(checked) => handleToggleActive(note.id, checked)}
                          />
                          <Label className="text-xs text-purple-200/50">
                            {note.is_active ? "Active" : "Inactive"}
                          </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(note.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
