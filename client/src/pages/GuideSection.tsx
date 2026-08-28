import { useParams, useNavigate, Navigate } from 'react-router-dom';
import AdminHeader from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const GuideSection = () => {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();

  if (section === 'sales-guide') {
    return <Navigate to="/sales-guide" replace />;
  }

  if (section === 'sop') {
    return <Navigate to="/sop" replace />;
  }

  if (section === 'new-hire') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col">
        <AdminHeader />
        <div className="border-b border-border px-4 py-2 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="font-semibold text-sm">New Hire Guide</span>
        </div>
        <div className="flex-1">
          <iframe
            src="https://melleka-new-hire-guide.melleka.app"
            title="New Hire Guide"
            className="w-full border-0"
            style={{ minHeight: 'calc(100vh - 112px)', height: 'calc(100vh - 112px)' }}
          />
        </div>
      </div>
    );
  }

  // SOP and anything else: Coming Soon
  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col">
      <AdminHeader />
      <div className="border-b border-border px-4 py-2 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="min-h-[44px]">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <span className="font-semibold text-sm capitalize">{section?.replace(/-/g, ' ') ?? 'Guide'}</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="text-4xl">📋</div>
          <h2 className="text-xl font-semibold">Coming Soon</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            This section is being built. Check back soon.
          </p>
          <Button variant="outline" onClick={() => navigate('/')} className="min-h-[44px]">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GuideSection;
