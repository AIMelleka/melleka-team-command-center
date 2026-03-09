import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '../shared';
import type { QaValidation } from '@/types/dailyReports';

interface Props {
  qaValidation: QaValidation | null;
}

export function QaValidationSection({ qaValidation }: Props) {
  if (!qaValidation) return null;

  return (
    <div>
      <SectionHeader title="Data Quality Check" icon={<Shield className="h-4 w-4" />} />
      <div className={`rounded-lg border p-4 ${qaValidation.passed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
        <div className="flex items-center gap-2 mb-2">
          {qaValidation.passed ? (
            <>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                Passed
              </Badge>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                Issues Found
              </Badge>
            </>
          )}
        </div>

        {qaValidation.issues && qaValidation.issues.length > 0 && (
          <ul className="space-y-1 mt-2">
            {qaValidation.issues.map((issue, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        )}

        {qaValidation.recommendation && (
          <p className="text-xs text-muted-foreground mt-2 border-t border-border/30 pt-2">
            {qaValidation.recommendation}
          </p>
        )}
      </div>
    </div>
  );
}
