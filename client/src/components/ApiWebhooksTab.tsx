import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { FileText, Activity, Trash2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import ApiDocsTab from '@/components/ApiDocsTab';

function UsageLogsTab() {
  const queryClient = useQueryClient();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['api-usage-logs', actionFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('api_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (actionFilter !== 'all') q = q.eq('action', actionFilter);
      if (statusFilter === 'success') q = q.gte('status_code', 200).lt('status_code', 300);
      if (statusFilter === 'error') q = q.gte('status_code', 400);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['api-usage-actions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('api_usage_logs')
        .select('action')
        .limit(500);
      const unique = [...new Set((data || []).map(r => r.action))].sort();
      return unique;
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { error } = await supabase
        .from('api_usage_logs')
        .delete()
        .lt('created_at', cutoff.toISOString());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-usage-logs'] });
      queryClient.invalidateQueries({ queryKey: ['api-usage-actions'] });
      toast({ title: 'Cleared', description: 'Logs older than 30 days removed.' });
    },
  });

  // Stats
  const totalRequests = logs.length;
  const errorCount = logs.filter(l => l.status_code >= 400).length;
  const avgDuration = totalRequests > 0
    ? Math.round(logs.reduce((s, l) => s + (l.duration_ms || 0), 0) / totalRequests)
    : 0;
  const uniqueActions = new Set(logs.map(l => l.action)).size;

  const statusBadge = (code: number) => {
    if (code < 300) return <Badge variant="default" className="text-[10px] px-1.5 py-0 font-mono bg-emerald-500/15 text-emerald-600 border-emerald-200">{code}</Badge>;
    if (code < 400) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{code}</Badge>;
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-mono">{code}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Requests', value: totalRequests, icon: Activity, color: 'text-primary' },
          { label: 'Errors', value: errorCount, icon: XCircle, color: 'text-destructive' },
          { label: 'Avg Duration', value: `${avgDuration}ms`, icon: Clock, color: 'text-muted-foreground' },
          { label: 'Unique Actions', value: uniqueActions, icon: CheckCircle, color: 'text-primary' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color} shrink-0`} />
              <div>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success (2xx)</SelectItem>
              <SelectItem value="error">Error (4xx+)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" />Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm('Delete logs older than 30 days?')) clearMutation.mutate();
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" />Clear 30d+
          </Button>
        </CardContent>
      </Card>

      {/* Log table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-[60px]">Status</TableHead>
                  <TableHead className="w-[80px]">Duration</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No API requests logged yet</TableCell></TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {format(new Date(log.created_at), 'MMM d HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono font-semibold">{log.action}</code>
                      </TableCell>
                      <TableCell>{statusBadge(log.status_code)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {log.user_email || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {log.error_message || log.response_summary || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ApiWebhooksTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Usage Logs</TabsTrigger>
          <TabsTrigger value="docs" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="logs"><UsageLogsTab /></TabsContent>
        <TabsContent value="docs"><ApiDocsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
