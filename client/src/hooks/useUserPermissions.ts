import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TOOL_CATALOG } from '@/data/toolCatalog';

export function useUserPermissions(userId?: string) {
  const { user, isAdmin } = useAuth();
  const targetId = userId || user?.id;

  const { data: permissions = [], isLoading, refetch } = useQuery({
    queryKey: ['user-tool-permissions', targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data, error } = await supabase
        .from('user_tool_permissions')
        .select('tool_key')
        .eq('user_id', targetId);
      if (error) throw error;
      return data.map(r => r.tool_key);
    },
    enabled: !!targetId,
  });

  const hasToolAccess = (toolKey: string): boolean => {
    if (isAdmin) return true;
    // Public-access tools are available to all authenticated users
    const tool = TOOL_CATALOG.find(t => t.key === toolKey);
    if (tool?.publicAccess) return true;
    return permissions.includes(toolKey);
  };

  return { permissions, isLoading, hasToolAccess, refetch };
}
