import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Trash2, ArrowLeft, Image, Loader2, Copy, Check, ExternalLink } from 'lucide-react';

interface PortfolioImage {
  name: string;
  url: string;
  created_at: string;
}

const PortfolioManager = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('proposal-assets')
        .list('portfolio', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const imageList: PortfolioImage[] = (data || [])
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => ({
          name: file.name,
          url: supabase.storage.from('proposal-assets').getPublicUrl(`portfolio/${file.name}`).data.publicUrl,
          created_at: file.created_at || ''
        }));

      setImages(imageList);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedFiles: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // Generate a clean filename
        const timestamp = Date.now();
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
        const fileName = `${timestamp}-${cleanName}`;

        const { error } = await supabase.storage
          .from('proposal-assets')
          .upload(`portfolio/${fileName}`, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;
        uploadedFiles.push(fileName);
      }

      toast.success(`Uploaded ${uploadedFiles.length} image(s) successfully!`);
      fetchImages();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image(s)');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      const { error } = await supabase.storage
        .from('proposal-assets')
        .remove([`portfolio/${fileName}`]);

      if (error) throw error;

      toast.success('Image deleted');
      setImages(images.filter(img => img.name !== fileName));
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete image');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success('URL copied!');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Portfolio Manager</h1>
              <p className="text-white/60 text-sm">Upload and manage portfolio images for the Creative Excellence carousel</p>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <Card className="bg-white/5 border-white/10 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-white/40 transition-colors">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                  id="image-upload"
                />
                <Label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  {uploading ? (
                    <Loader2 className="w-10 h-10 text-white/40 animate-spin" />
                  ) : (
                    <Image className="w-10 h-10 text-white/40" />
                  )}
                  <div>
                    <p className="text-white font-medium">
                      {uploading ? 'Uploading...' : 'Click to upload images'}
                    </p>
                    <p className="text-white/50 text-sm">PNG, JPG, WebP up to 10MB each</p>
                  </div>
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Images Grid */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                Portfolio Images ({images.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-white/40" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No images uploaded yet</p>
                <p className="text-sm">Upload your first portfolio image above</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
                  <div
                    key={image.name}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-black/30 border border-white/10"
                  >
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={() => copyUrl(image.url)}
                      >
                        {copiedUrl === image.url ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={() => window.open(image.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-400 hover:bg-red-500/20"
                        onClick={() => handleDelete(image.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Filename */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white/80 truncate">{image.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
          <h3 className="text-lg font-semibold text-emerald-400 mb-2">How to use these images</h3>
          <p className="text-white/70 text-sm">
            Once uploaded, these images will automatically appear in the "Creative Excellence" carousel on proposal pages.
            You can also copy the URL of any image to use it elsewhere.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortfolioManager;
