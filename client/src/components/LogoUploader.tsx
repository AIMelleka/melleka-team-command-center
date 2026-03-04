import { useState, useRef } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiService } from '@/lib/apiService';

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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${proposalId}/logo-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proposal-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('proposal-assets')
        .getPublicUrl(fileName);

      const newLogoUrl = urlData.publicUrl;

      await updateProposalLogo(newLogoUrl);
      onLogoUpdated(newLogoUrl);
      toast.success('Logo updated successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
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

      await updateProposalLogo(newLogoUrl);
      onLogoUpdated(newLogoUrl);
      toast.success('Logo refreshed from website!');
    } catch (error) {
      console.error('Error refreshing logo:', error);
      toast.error('Failed to refresh logo. Try uploading manually.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateProposalLogo = async (newLogoUrl: string) => {
    // Fetch current content and update
    const { data: proposal } = await supabase
      .from('proposals')
      .select('content')
      .eq('id', proposalId)
      .single();

    if (proposal) {
      const currentContent = proposal.content as Record<string, unknown> || {};
      const currentHero = currentContent.hero as Record<string, unknown> || {};
      const currentBrandStyles = currentContent.brandStyles as Record<string, unknown> || {};

      const updatedContent = {
        ...currentContent,
        hero: {
          ...currentHero,
          clientLogo: newLogoUrl,
        },
        brandStyles: {
          ...currentBrandStyles,
          logo: newLogoUrl,
        },
      };

      const { error: saveError } = await supabase
        .from('proposals')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ content: updatedContent as any })
        .eq('id', proposalId);

      if (saveError) {
        throw saveError;
      }
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