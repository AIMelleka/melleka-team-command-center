import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Home } from 'lucide-react';
import mellekaLogo from '@/assets/melleka-logo.png';

const UserHeader = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-3 md:px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/user" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={mellekaLogo} alt="Melleka" className="h-8 w-auto" />
            <span className="text-lg font-semibold text-foreground">Content Hub</span>
          </Link>
          <Link to="/user">
            <Button variant="ghost" size="sm">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
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
  );
};

export default UserHeader;
