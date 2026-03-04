import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { 
  Mail, ArrowLeft, Loader2, Send, Reply, Copy, Check,
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
          // Reply mode
          originalEmail: mode === "reply" ? originalEmail : undefined,
          replyIntent: mode === "reply" ? replyIntent : undefined,
          // Edit mode
          draftEmail: mode === "edit" ? draftEmail : undefined,
          editInstructions: mode === "edit" ? editInstructions : undefined,
          // Compose mode
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
            <Mail className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-purple-200/60 mb-4">You need admin access to use the Email Writer.</p>
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                <Mail className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Email Writer</h1>
                <p className="text-sm text-purple-200/60">Professional email assistant</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Mode Selection */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">What do you need?</CardTitle>
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
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-purple-500/50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-500/20 cursor-pointer transition-all"
                    >
                      <Reply className="h-6 w-6 mb-2 text-purple-400" />
                      <span className="text-white font-medium text-sm">Reply</span>
                      <span className="text-xs text-purple-200/50 mt-1 text-center">Respond to email</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="edit" id="edit" className="peer sr-only" />
                    <Label
                      htmlFor="edit"
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-purple-500/50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-500/20 cursor-pointer transition-all"
                    >
                      <Pencil className="h-6 w-6 mb-2 text-purple-400" />
                      <span className="text-white font-medium text-sm">Edit Draft</span>
                      <span className="text-xs text-purple-200/50 mt-1 text-center">Polish your draft</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="compose" id="compose" className="peer sr-only" />
                    <Label
                      htmlFor="compose"
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-purple-500/50 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-500/20 cursor-pointer transition-all"
                    >
                      <Send className="h-6 w-6 mb-2 text-purple-400" />
                      <span className="text-white font-medium text-sm">Compose</span>
                      <span className="text-xs text-purple-200/50 mt-1 text-center">Write new email</span>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Reply Mode Inputs */}
            {mode === "reply" && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Reply className="h-5 w-5 text-purple-400" />
                    Reply Details
                  </CardTitle>
                  <CardDescription className="text-purple-200/60">
                    Paste the email you received and tell us how you want to respond
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-purple-200/70">Original Email *</Label>
                    <Textarea
                      value={originalEmail}
                      onChange={(e) => setOriginalEmail(e.target.value)}
                      placeholder="Paste the email you want to reply to..."
                      className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-purple-200/70">How should we respond?</Label>
                    <Textarea
                      value={replyIntent}
                      onChange={(e) => setReplyIntent(e.target.value)}
                      placeholder="e.g., Politely decline the meeting, Accept and ask for more details, Request a reschedule to next week..."
                      className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Edit Mode Inputs */}
            {mode === "edit" && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Pencil className="h-5 w-5 text-purple-400" />
                    Edit Your Draft
                  </CardTitle>
                  <CardDescription className="text-purple-200/60">
                    Paste your draft email and we'll polish it for you
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-purple-200/70">Your Draft Email *</Label>
                    <Textarea
                      value={draftEmail}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      placeholder="Paste the email you've written that needs editing..."
                      className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-purple-200/70">What should we improve?</Label>
                    <Textarea
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                      placeholder="e.g., Make it more professional, Fix grammar and spelling, Make it shorter and punchier, Add a stronger call to action..."
                      className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Compose Mode Inputs */}
            {mode === "compose" && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Send className="h-5 w-5 text-purple-400" />
                    Compose Details
                  </CardTitle>
                  <CardDescription className="text-purple-200/60">
                    Tell us about the email you want to write
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-purple-200/70">Who is this for?</Label>
                    <Input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="e.g., A potential client, My manager, A vendor..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-purple-200/70">Purpose of Email *</Label>
                    <Textarea
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g., Follow up on a sales call, Request a quote, Introduce our services..."
                      className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-purple-200/70">Key Points to Include</Label>
                    <Textarea
                      value={keyPoints}
                      onChange={(e) => setKeyPoints(e.target.value)}
                      placeholder="e.g., Mention our 20% discount, Include the proposal PDF, Ask for a call next Tuesday..."
                      className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tone Selection */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">Tone</CardTitle>
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
                        className="px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-500/20 cursor-pointer transition-all text-white capitalize"
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
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 h-12 text-lg"
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
            <Card className="bg-white/5 border-white/10 sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5 text-purple-400" />
                    Generated Email
                  </CardTitle>
                  {generatedEmail && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isGenerating}
                        className="border-white/20 text-purple-200 hover:bg-white/10"
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="border-white/20 text-purple-200 hover:bg-white/10"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 mr-1 text-green-400" />
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
                      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <p className="text-xs text-purple-300/70 mb-1">Subject Line</p>
                        <p className="text-white font-medium">{subjectLine}</p>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <pre className="text-white whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {generatedEmail}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Mail className="h-16 w-16 text-purple-400/30 mb-4" />
                    <p className="text-purple-200/60">
                      Your generated email will appear here
                    </p>
                    <p className="text-xs text-purple-300/40 mt-1">
                      Fill in the details and click Generate
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
