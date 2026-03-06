import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const BUCKET = 'creative-images';
    const MIN_SIZE = 30000; // 30KB threshold

    // List all files in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 1000 });

    if (listError) throw listError;

    // Also check subdirectories (files are often stored as client/filename)
    const allFiles: { name: string; size: number }[] = [];
    
    // Top-level files
    for (const f of files || []) {
      if (f.metadata?.size !== undefined) {
        allFiles.push({ name: f.name, size: f.metadata.size });
      } else if (f.id === null) {
        // It's a folder, list its contents
        const { data: subFiles } = await supabase.storage
          .from(BUCKET)
          .list(f.name, { limit: 1000 });
        for (const sf of subFiles || []) {
          if (sf.metadata?.size !== undefined) {
            allFiles.push({ name: `${f.name}/${sf.name}`, size: sf.metadata.size });
          }
        }
      }
    }

    const smallFiles = allFiles.filter(f => f.size < MIN_SIZE);
    
    if (smallFiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No small files found', total: allFiles.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete small files in batches
    const paths = smallFiles.map(f => f.name);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({
      message: `Deleted ${smallFiles.length} small images (< 30KB)`,
      deleted: smallFiles.length,
      kept: allFiles.length - smallFiles.length,
      deletedFiles: paths,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
