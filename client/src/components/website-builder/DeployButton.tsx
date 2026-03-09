import { useState } from "react";
import { Rocket, Loader2, Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deployWebsite } from "@/lib/websiteApi";
import { toast } from "sonner";

interface DeployButtonProps {
  projectId: string;
  disabled?: boolean;
  onDeployed?: (url: string) => void;
}

export default function DeployButton({ projectId, disabled, onDeployed }: DeployButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeployedUrl(null);
    try {
      const result = await deployWebsite(projectId);
      setDeployedUrl(result.url);
      toast.success("Website deployed successfully!");
      onDeployed?.(result.url);
    } catch (err: any) {
      toast.error(err.message || "Deploy failed");
    } finally {
      setIsDeploying(false);
    }
  };

  const copyUrl = async () => {
    if (!deployedUrl) return;
    await navigator.clipboard.writeText(deployedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      {deployedUrl && (
        <div className="flex items-center gap-1 bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs">
          <Check className="h-3 w-3" />
          <a href={deployedUrl} target="_blank" rel="noopener noreferrer" className="hover:underline max-w-[200px] truncate">
            {deployedUrl.replace("https://", "")}
          </a>
          <button onClick={copyUrl} className="ml-1 hover:text-green-400">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
          <a href={deployedUrl} target="_blank" rel="noopener noreferrer" className="hover:text-green-400">
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      <Button
        onClick={handleDeploy}
        disabled={disabled || isDeploying}
        size="sm"
        className="gap-1.5"
      >
        {isDeploying ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Deploying...
          </>
        ) : (
          <>
            <Rocket className="h-3.5 w-3.5" />
            Deploy
          </>
        )}
      </Button>
    </div>
  );
}
