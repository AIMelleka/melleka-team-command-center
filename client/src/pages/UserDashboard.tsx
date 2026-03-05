import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { TOOL_CATALOG, CATEGORY_LABELS } from '@/data/toolCatalog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Lock, Loader2, Bot } from 'lucide-react';
import { MFASettings } from '@/components/MFASettings';
import GenieLamp from '@/components/icons/GenieLamp';
import mellekaLogo from '@/assets/melleka-logo.png';

const UserDashboard = () => {
  const { user, signOut } = useAuth();
  const { permissions, isLoading, hasToolAccess } = useUserPermissions();

  const handleSignOut = async () => {
    await signOut();
  };

  const permittedTools = TOOL_CATALOG.filter(t => hasToolAccess(t.key));
  const categories = [...new Set(permittedTools.map(t => t.category))];

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={mellekaLogo} alt="Melleka" className="h-8 w-auto" />
            <span className="text-lg font-semibold text-foreground">Content Hub</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 md:px-4 py-6 md:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <GenieLamp size={48} className="mx-auto mb-4 animate-float" />
            <h1 className="text-3xl font-display font-bold mb-2">
              Welcome to the Content Hub
            </h1>
            <p className="text-muted-foreground">
              Your tools for creating and managing content
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : permittedTools.length === 0 ? (
            <div className="text-center py-12">
              <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold mb-2">No tools available</h2>
              <p className="text-muted-foreground">
                Contact your administrator to get access to tools.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {categories.map(cat => {
                const catTools = permittedTools.filter(t => t.category === cat);
                return (
                  <div key={cat}>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                      {CATEGORY_LABELS[cat]}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {catTools.map(tool => {
                        const Icon = tool.icon;
                        return (
                          <Link key={tool.key} to={tool.route} className="block">
                            <Card className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group h-full">
                              <CardHeader className="pb-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                    <Icon className="h-5 w-5 text-primary" />
                                  </div>
                                  <CardTitle className="text-base">{tool.label}</CardTitle>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <CardDescription className="text-sm">
                                  {tool.description}
                                </CardDescription>
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Super Agent */}
          <div className="mt-12 pt-8 border-t">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Super Agent
            </h2>
            <Link to="/" className="block">
              <Card className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">Super Agent</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Chat with our AI super agent — it can read files, write code, run commands, and get real work done.
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Security Settings */}
          <div className="mt-12 pt-8 border-t">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Security
            </h2>
            <MFASettings />
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;
