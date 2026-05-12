import { useState, useRef } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiService } from '@/lib/apiService';

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
  : '/api';

interface LogoUploaderProps {
  currentLogo?: string;
  proposalId: string;
  websiteUrl?: string;
  onLogoUpdated: (newLogoUrl: string) => void;
  primaryColor: string;
  isLightBackground: boolean;
}

export const LogoUploader = ({
  currentLogo,
  proposalId,
  websiteUrl,
  onLogoUpdated,
  primaryColor,
  isLightBackground,
}: LogoUploaderProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploading(true);

    try {
      // Upload via server endpoint (bypasses storage RLS)
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('proposal_id', proposalId);

      const resp = await fetch(`${API_BASE}/uploads/proposal-logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }

      const { url: newLogoUrl } = await resp.json();

      onLogoUpdated(newLogoUrl);
      toast.success('Logo updated successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRefreshLogo = async () => {
    if (!websiteUrl) {
      toast.error('No website URL available to refresh logo');
      return;
    }

    setIsRefreshing(true);
    toast.info('Re-scraping website for logo...');

    try {
      const { data, error } = await apiService.scrapeWebsite(websiteUrl, 1);

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to scrape website');
      }

      const newLogoUrl = data.branding?.logo;

      if (!newLogoUrl) {
        toast.error('No logo found on website. Try uploading manually.');
        return;
      }

      // Update proposal content in DB with the scraped logo URL
      const { data: proposal } = await supabase
        .from('proposals')
        .select('content')
        .eq('id', proposalId)
        .single();

      if (proposal) {
        const content = proposal.content as Record<string, any> || {};
        await supabase
          .from('proposals')
          .update({
            content: {
              ...content,
              hero: { ...(content.hero || {}), clientLogo: newLogoUrl },
              brandStyles: { ...(content.brandStyles || {}), logo: newLogoUrl },
            } as any,
          })
          .eq('id', proposalId);
      }

      onLogoUpdated(newLogoUrl);
      toast.success('Logo refreshed from website!');
    } catch (error) {
      console.error('Error refreshing logo:', error);
      toast.error('Failed to refresh logo. Try uploading manually.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const buttonStyle = {
    background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 80%, white))`,
    color: 'white',
    boxShadow: isLightBackground 
      ? `0 4px 12px color-mix(in srgb, ${primaryColor} 30%, transparent)`
      : `0 4px 12px ${primaryColor}50`,
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id="logo-upload"
      />
      
      {/* Refresh from Website Button */}
      {websiteUrl && (
        <Button
          onClick={handleRefreshLogo}
          disabled={isRefreshing || isUploading}
          size="sm"
          variant="outline"
          className="gap-2 transition-all"
          style={{
            borderColor: primaryColor,
            color: primaryColor,
          }}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Refresh Logo
            </>
          )}
        </Button>
      )}
      
      {/* Upload Button */}
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || isRefreshing}
        size="sm"
        className="gap-2 transition-all"
        style={buttonStyle}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            Upload Logo
          </>
        )}
      </Button>
    </div>
  );
};

export default LogoUploader;