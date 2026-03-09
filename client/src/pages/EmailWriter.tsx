import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Mail, Loader2, Send, Reply, Copy, Check,
  Sparkles, RefreshCw, Pencil
} from "lucide-react";

type EmailMode = "reply" | "compose" | "edit";

export default function EmailWriter() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [mode, setMode] = useState<EmailMode>("reply");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reply mode inputs
  const [originalEmail, setOriginalEmail] = useState("");
  const [replyIntent, setReplyIntent] = useState("");

  // Edit mode inputs
  const [draftEmail, setDraftEmail] = useState("");
  const [editInstructions, setEditInstructions] = useState("");

  // Compose mode inputs
  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [tone, setTone] = useState("professional");

  // Output
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [subjectLine, setSubjectLine] = useState("");

  const handleGenerate = async () => {
    if (mode === "reply" && !originalEmail.trim()) {
      toast.error("Please paste the email you want to reply to");
      return;
    }
    if (mode === "compose" && !purpose.trim()) {
      toast.error("Please describe the purpose of your email");
      return;
    }
    if (mode === "edit" && !draftEmail.trim()) {
      toast.error("Please paste your draft email to edit");
      return;
    }

    setIsGenerating(true);
    setGeneratedEmail("");
    setSubjectLine("");

    try {
      const { data, error } = await supabase.functions.invoke("email-writer", {
        body: {
          mode,
          originalEmail: mode === "reply" ? originalEmail : undefined,
          replyIntent: mode === "reply" ? replyIntent : undefined,
          draftEmail: mode === "edit" ? draftEmail : undefined,
          editInstructions: mode === "edit" ? editInstructions : undefined,
          recipient: mode === "compose" ? recipient : undefined,
          purpose: mode === "compose" ? purpose : undefined,
          keyPoints: mode === "compose" ? keyPoints : undefined,
          tone,
        },
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedEmail(data.body);
        setSubjectLine(data.subject || "");
        toast.success("Email generated!");
      } else {
        throw new Error(data.error || "Failed to generate email");
      }
    } catch (error: any) {
      console.error("Email generation error:", error);
      toast.error(error.message || "Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const fullEmail = subjectLine
      ? `Subject: ${subjectLine}\n\n${generatedEmail}`
      : generatedEmail;

    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

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
            <Mail className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">You need admin access to use the Email Writer.</p>
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

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl md:text-4xl font-bold">Email Writer</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Professional email assistant
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Mode Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What do you need?</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as EmailMode)}
                  className="grid grid-cols-3 gap-3"
                >
                  <div>
                    <RadioGroupItem value="reply" id="reply" className="peer sr-only" />
                    <Label
                      htmlFor="reply"
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-border bg-muted/30 p-4 hover:bg-muted/50 hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                    >
                      <Reply className="h-6 w-6 mb-2 text-primary" />
                      <span className="font-medium text-sm">Reply</span>
                      <span className="text-xs text-muted-foreground mt-1 text-center">Respond to email</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="edit" id="edit" className="peer sr-only" />
                    <Label
                      htmlFor="edit"
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-border bg-muted/30 p-4 hover:bg-muted/50 hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                    >
                      <Pencil className="h-6 w-6 mb-2 text-primary" />
                      <span className="font-medium text-sm">Edit Draft</span>
                      <span className="text-xs text-muted-foreground mt-1 text-center">Polish your draft</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="compose" id="compose" className="peer sr-only" />
                    <Label
                      htmlFor="compose"
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-border bg-muted/30 p-4 hover:bg-muted/50 hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                    >
                      <Send className="h-6 w-6 mb-2 text-primary" />
                      <span className="font-medium text-sm">Compose</span>
                      <span className="text-xs text-muted-foreground mt-1 text-center">Write new email</span>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Reply Mode Inputs */}
            {mode === "reply" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Reply className="h-5 w-5 text-primary" />
                    Reply Details
                  </CardTitle>
                  <CardDescription>
                    Paste the email you received and tell us how you want to respond
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Original Email *</Label>
                    <Textarea
                      value={originalEmail}
                      onChange={(e) => setOriginalEmail(e.target.value)}
                      placeholder="Paste the email you want to reply to..."
                      className="min-h-[150px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>How should we respond?</Label>
                    <Textarea
                      value={replyIntent}
                      onChange={(e) => setReplyIntent(e.target.value)}
                      placeholder="e.g., Politely decline the meeting, Accept and ask for more details, Request a reschedule to next week..."
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Edit Mode Inputs */}
            {mode === "edit" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Pencil className="h-5 w-5 text-primary" />
                    Edit Your Draft
                  </CardTitle>
                  <CardDescription>
                    Paste your draft email and we'll polish it for you
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Your Draft Email *</Label>
                    <Textarea
                      value={draftEmail}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      placeholder="Paste the email you've written that needs editing..."
                      className="min-h-[150px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>What should we improve?</Label>
                    <Textarea
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                      placeholder="e.g., Make it more professional, Fix grammar and spelling, Make it shorter and punchier, Add a stronger call to action..."
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Compose Mode Inputs */}
            {mode === "compose" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    Compose Details
                  </CardTitle>
                  <CardDescription>
                    Tell us about the email you want to write
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Who is this for?</Label>
                    <Input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="e.g., A potential client, My manager, A vendor..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Purpose of Email *</Label>
                    <Textarea
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g., Follow up on a sales call, Request a quote, Introduce our services..."
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Key Points to Include</Label>
                    <Textarea
                      value={keyPoints}
                      onChange={(e) => setKeyPoints(e.target.value)}
                      placeholder="e.g., Mention our 20% discount, Include the proposal PDF, Ask for a call next Tuesday..."
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tone Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tone</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={tone}
                  onValueChange={setTone}
                  className="flex flex-wrap gap-2"
                >
                  {["professional", "friendly", "formal", "casual", "persuasive"].map((t) => (
                    <div key={t}>
                      <RadioGroupItem value={t} id={t} className="peer sr-only" />
                      <Label
                        htmlFor={t}
                        className="px-4 py-2 rounded-full border border-border bg-muted/30 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all capitalize"
                      >
                        {t}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Email
                </>
              )}
            </Button>
          </div>

          {/* Output Section */}
          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Generated Email
                  </CardTitle>
                  {generatedEmail && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isGenerating}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 mr-1 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {generatedEmail ? (
                  <div className="space-y-4">
                    {subjectLine && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Subject Line</p>
                        <p className="font-medium">{subjectLine}</p>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-muted/50 border border-border">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {generatedEmail}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Mail className="h-16 w-16 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      Your generated email will appear here
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Fill in the details and click Generate
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
