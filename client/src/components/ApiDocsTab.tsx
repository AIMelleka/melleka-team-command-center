import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Copy, ChevronDown, ChevronUp, Globe, Lock, Key, RefreshCw, ArrowRight } from 'lucide-react';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-gateway`;

interface Endpoint {
  action: string;
  description: string;
  auth: boolean;
  params?: { name: string; type: string; required: boolean; description: string }[];
  example: Record<string, unknown>;
  response: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    action: 'login',
    description: 'Authenticate and receive an access token + refresh token.',
    auth: false,
    params: [
      { name: 'email', type: 'string', required: true, description: 'Account email address' },
      { name: 'password', type: 'string', required: true, description: 'Account password' },
    ],
    example: { action: 'login', params: { email: 'AI@MellekaMarketing.com', password: '••••••••' } },
    response: '{ "access_token": "eyJ...", "refresh_token": "abc123", "expires_at": 1772011212, "user_id": "uuid" }',
  },
  {
    action: 'refresh',
    description: 'Refresh an expired access token using the refresh token.',
    auth: false,
    params: [
      { name: 'refresh_token', type: 'string', required: true, description: 'The refresh token from login' },
    ],
    example: { action: 'refresh', params: { refresh_token: 'emzv6iy4gxeo' } },
    response: '{ "access_token": "eyJ...", "refresh_token": "new_token", "expires_at": 1772014812 }',
  },
  {
    action: 'list_clients',
    description: 'Retrieve all managed clients with their configuration.',
    auth: true,
    example: { action: 'list_clients' },
    response: '{ "clients": [{ "client_name": "...", "tier": "premium", "is_active": true, ... }] }',
  },
  {
    action: 'get_client',
    description: 'Get a single client by name.',
    auth: true,
    params: [{ name: 'client_name', type: 'string', required: true, description: 'Exact client name' }],
    example: { action: 'get_client', params: { client_name: 'Fiber Sales' } },
    response: '{ "client": { "client_name": "Fiber Sales", "tier": "premium", ... } }',
  },
  {
    action: 'create_client',
    description: 'Create a new managed client.',
    auth: true,
    params: [
      { name: 'client_name', type: 'string', required: true, description: 'Client name' },
      { name: 'tier', type: 'string', required: false, description: 'basic | premium' },
      { name: 'industry', type: 'string', required: false, description: 'Client industry' },
      { name: 'domain', type: 'string', required: false, description: 'Website domain' },
    ],
    example: { action: 'create_client', params: { client_name: 'New Client', tier: 'premium', industry: 'Healthcare' } },
    response: '{ "client": { "id": "uuid", "client_name": "New Client", ... } }',
  },
  {
    action: 'update_client',
    description: 'Update an existing client by name.',
    auth: true,
    params: [
      { name: 'client_name', type: 'string', required: true, description: 'Client to update' },
      { name: '...fields', type: 'any', required: false, description: 'Any fields to update' },
    ],
    example: { action: 'update_client', params: { client_name: 'Fiber Sales', tier: 'basic', is_active: false } },
    response: '{ "client": { ... } }',
  },
  {
    action: 'list_decks',
    description: 'List all performance decks (summary fields only).',
    auth: true,
    example: { action: 'list_decks' },
    response: '{ "decks": [{ "slug": "d-abc123", "client_name": "...", "status": "ready", ... }] }',
  },
  {
    action: 'get_deck',
    description: 'Get full deck content by slug.',
    auth: true,
    params: [{ name: 'slug', type: 'string', required: true, description: 'Deck slug' }],
    example: { action: 'get_deck', params: { slug: 'd-abc123' } },
    response: '{ "deck": { "slug": "...", "content": { ... }, "screenshots": [...], ... } }',
  },
  {
    action: 'update_deck',
    description: 'Update deck fields by slug.',
    auth: true,
    params: [
      { name: 'slug', type: 'string', required: true, description: 'Deck slug' },
      { name: '...fields', type: 'any', required: false, description: 'Fields to update (content, status, etc.)' },
    ],
    example: { action: 'update_deck', params: { slug: 'd-abc123', status: 'published' } },
    response: '{ "deck": { ... } }',
  },
  {
    action: 'list_proposals',
    description: 'List all proposals (summary fields).',
    auth: true,
    example: { action: 'list_proposals' },
    response: '{ "proposals": [{ "slug": "...", "title": "...", "status": "draft", ... }] }',
  },
  {
    action: 'get_proposal',
    description: 'Get full proposal content by slug.',
    auth: true,
    params: [{ name: 'slug', type: 'string', required: true, description: 'Proposal slug' }],
    example: { action: 'get_proposal', params: { slug: 'proposal-abc' } },
    response: '{ "proposal": { "content": { ... }, ... } }',
  },
  {
    action: 'list_ad_reviews',
    description: 'List ad review history, optionally filtered by client.',
    auth: true,
    params: [
      { name: 'client_name', type: 'string', required: false, description: 'Filter by client' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 20)' },
    ],
    example: { action: 'list_ad_reviews', params: { client_name: 'Fiber Sales', limit: 5 } },
    response: '{ "reviews": [{ "client_name": "...", "review_date": "...", "summary": "...", ... }] }',
  },
  {
    action: 'list_seo_history',
    description: 'List SEO analysis history, optionally filtered by client.',
    auth: true,
    params: [
      { name: 'client_name', type: 'string', required: false, description: 'Filter by client' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 20)' },
    ],
    example: { action: 'list_seo_history', params: { client_name: 'Global Guard Insurance - GGIS', limit: 10 } },
    response: '{ "history": [{ "domain": "...", "organic_traffic": 1500, ... }] }',
  },
  {
    action: 'list_ppc_sessions',
    description: 'List PPC optimization sessions.',
    auth: true,
    params: [
      { name: 'client_name', type: 'string', required: false, description: 'Filter by client' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 20)' },
    ],
    example: { action: 'list_ppc_sessions', params: { limit: 5 } },
    response: '{ "sessions": [{ "client_name": "...", "platform": "google", "status": "...", ... }] }',
  },
  {
    action: 'list_ppc_snapshots',
    description: 'List PPC daily performance snapshots.',
    auth: true,
    params: [
      { name: 'client_name', type: 'string', required: false, description: 'Filter by client' },
      { name: 'days', type: 'number', required: false, description: 'Number of days (default 30)' },
    ],
    example: { action: 'list_ppc_snapshots', params: { client_name: 'Dave', days: 7 } },
    response: '{ "snapshots": [{ "snapshot_date": "...", "spend": 500, "conversions": 12, ... }] }',
  },
  {
    action: 'list_client_health',
    description: 'List client health scores and history.',
    auth: true,
    example: { action: 'list_client_health' },
    response: '{ "health": [{ "client_name": "...", "health_score": 85, ... }] }',
  },
  {
    action: 'list_users',
    description: 'List all users with admin status.',
    auth: true,
    example: { action: 'list_users' },
    response: '{ "users": [{ "id": "uuid", "email": "...", "is_admin": true, ... }] }',
  },
  {
    action: 'invoke_function',
    description: 'Call any backend function by name (deck generation, ad review, etc.).',
    auth: true,
    params: [
      { name: 'function_name', type: 'string', required: true, description: 'Backend function name' },
      { name: 'payload', type: 'object', required: false, description: 'Request body for the function' },
    ],
    example: { action: 'invoke_function', params: { function_name: 'generate-deck-async', payload: { clientName: 'Fiber Sales' } } },
    response: '{ "result": { ... } }',
  },
  {
    action: 'query',
    description: 'Generic read from any table with filters.',
    auth: true,
    params: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'select', type: 'string', required: false, description: 'Column selection (default *)' },
      { name: 'filters', type: 'object', required: false, description: 'Key-value equality filters' },
      { name: 'order_by', type: 'string', required: false, description: 'Column to order by (descending)' },
      { name: 'limit', type: 'number', required: false, description: 'Max rows (default 50)' },
    ],
    example: { action: 'query', params: { table: 'decks', select: 'slug,client_name,status', filters: { status: 'ready' }, limit: 10 } },
    response: '{ "data": [{ "slug": "...", "client_name": "...", "status": "ready" }] }',
  },
  {
    action: 'insert',
    description: 'Generic insert a record into any table.',
    auth: true,
    params: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'record', type: 'object', required: true, description: 'Record to insert' },
    ],
    example: { action: 'insert', params: { table: 'client_ai_memory', record: { client_name: 'Dave', content: 'Prefers call tracking', memory_type: 'preference' } } },
    response: '{ "data": { "id": "uuid", ... } }',
  },
  {
    action: 'update',
    description: 'Generic update records in any table by matching columns.',
    auth: true,
    params: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'match', type: 'object', required: true, description: 'Columns to match (WHERE clause)' },
      { name: 'updates', type: 'object', required: true, description: 'Fields to update' },
    ],
    example: { action: 'update', params: { table: 'managed_clients', match: { client_name: 'Dave' }, updates: { tier: 'premium' } } },
    response: '{ "data": [{ ... }] }',
  },
  {
    action: 'delete',
    description: 'Generic delete records from any table by matching columns.',
    auth: true,
    params: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'match', type: 'object', required: true, description: 'Columns to match for deletion' },
    ],
    example: { action: 'delete', params: { table: 'client_ai_memory', match: { id: 'some-uuid' } } },
    response: '{ "data": [{ ... }] }',
  },
];

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied', description: 'Code copied to clipboard' });
  };

  return (
    <div className="relative group">
      {label && <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">{label}</p>}
      <pre className="bg-muted/60 border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copy}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <Badge variant={ep.auth ? 'default' : 'secondary'} className="text-[10px] font-mono px-1.5 py-0">
            {ep.auth ? 'AUTH' : 'PUBLIC'}
          </Badge>
          <code className="text-sm font-semibold font-mono">{ep.action}</code>
          <span className="text-xs text-muted-foreground hidden sm:inline">{ep.description}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t bg-muted/20">
          <p className="text-sm text-muted-foreground pt-3">{ep.description}</p>

          {ep.params && ep.params.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Parameters</p>
              <div className="space-y-1">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <code className="font-mono text-primary">{p.name}</code>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{p.type}</Badge>
                    {p.required && <Badge variant="destructive" className="text-[10px] px-1 py-0">required</Badge>}
                    <span className="text-muted-foreground">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <CodeBlock label="Request" code={JSON.stringify(ep.example, null, 2)} />
          <CodeBlock label="Response" code={ep.response} />
        </div>
      )}
    </div>
  );
}

export default function ApiDocsTab() {
  const quickStart = `// Step 1: Login
const res = await fetch("${BASE_URL}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "login",
    params: { email: "AI@MellekaMarketing.com", password: "YOUR_PASSWORD" }
  })
});
const { access_token } = await res.json();

// Step 2: Use the token for any action
const clients = await fetch("${BASE_URL}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${access_token}\`
  },
  body: JSON.stringify({ action: "list_clients" })
});
const data = await clients.json();`;

  const pythonExample = `import requests

BASE = "${BASE_URL}"

# Login
token = requests.post(BASE, json={
    "action": "login",
    "params": {"email": "AI@MellekaMarketing.com", "password": "YOUR_PASSWORD"}
}).json()["access_token"]

# List clients
clients = requests.post(BASE, json={"action": "list_clients"},
    headers={"Authorization": f"Bearer {token}"}
).json()`;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            API Gateway Documentation
          </CardTitle>
          <CardDescription>
            Connect your external AI bot to the full platform via a single REST endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <Key className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Single Endpoint</p>
                <p className="text-xs text-muted-foreground">All actions go through one URL via POST</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Admin-Only Access</p>
                <p className="text-xs text-muted-foreground">Requires admin role after login</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <RefreshCw className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Token Refresh</p>
                <p className="text-xs text-muted-foreground">Access tokens expire in 1 hour; use refresh action</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Base URL</p>
            <CodeBlock code={BASE_URL} />
          </div>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock label="JavaScript / Node.js" code={quickStart} />
          <CodeBlock label="Python" code={pythonExample} />
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">All Endpoints ({ENDPOINTS.length})</CardTitle>
          <CardDescription>Click any endpoint to see parameters, examples, and response format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ENDPOINTS.map((ep) => (
            <EndpointCard key={ep.action} ep={ep} />
          ))}
        </CardContent>
      </Card>

      {/* Auth flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Authentication Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            {[
              { step: '1', title: 'Login', desc: 'POST with email + password to get access_token' },
              { step: '2', title: 'Use Token', desc: 'Add Authorization: Bearer <token> to all requests' },
              { step: '3', title: 'Refresh', desc: 'When expired (1hr), call refresh with refresh_token' },
              { step: '4', title: 'Full Access', desc: 'All 23 actions available with admin privileges' },
            ].map((s) => (
              <div key={s.step} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{s.step}</div>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
