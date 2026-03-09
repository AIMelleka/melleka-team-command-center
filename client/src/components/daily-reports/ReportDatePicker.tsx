import { useState } from 'react';
import { CalendarDays, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import type { DateRangeSelection, DateMode, DatePreset } from '@/types/dailyReports';

interface Props {
  dateSelection: DateRangeSelection;
  availableDates: string[];
  onDateChange: (date: string) => void;
  onRangeChange: (start: string, end: string, preset: DatePreset) => void;
  onModeChange: (mode: DateMode) => void;
}

const presets: { key: DatePreset; label: string }[] = [
  { key: 'last_7', label: 'Last 7 Days' },
  { key: 'last_14', label: 'Last 14 Days' },
  { key: 'last_30', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom Range' },
];

export function ReportDatePicker({ dateSelection, availableDates, onDateChange, onRangeChange, onModeChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const isSingle = dateSelection.mode === 'single';

  // Display text for trigger button
  const displayText = (() => {
    if (isSingle) {
      if (!dateSelection.singleDate) return 'Select date';
      try { return format(parseISO(dateSelection.singleDate), 'MMM d, yyyy'); }
      catch { return dateSelection.singleDate; }
    }
    if (dateSelection.startDate && dateSelection.endDate) {
      try {
        const s = format(parseISO(dateSelection.startDate), 'MMM d');
        const e = format(parseISO(dateSelection.endDate), 'MMM d, yyyy');
        return `${s} - ${e}`;
      } catch { return `${dateSelection.startDate} - ${dateSelection.endDate}`; }
    }
    return 'Select range';
  })();

  const handlePreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    // Calculate range from the most recent available date
    const latestDate = availableDates[0];
    if (!latestDate) return;
    const end = new Date(latestDate + 'T12:00:00');
    const daysMap: Record<string, number> = { last_7: 7, last_14: 14, last_30: 30 };
    const days = daysMap[preset] || 7;
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    onRangeChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'), preset);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      const s = format(customStart, 'yyyy-MM-dd');
      const e = format(customEnd, 'yyyy-MM-dd');
      onRangeChange(s > e ? e : s, s > e ? s : e, 'custom');
      setIsOpen(false);
      setShowCustom(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 text-sm">
          {isSingle ? <CalendarDays className="h-4 w-4" /> : <CalendarRange className="h-4 w-4" />}
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Mode toggle */}
        <div className="flex border-b">
          <button
            onClick={() => { onModeChange('single'); setShowCustom(false); }}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              isSingle ? 'bg-primary/10 text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Single Date
          </button>
          <button
            onClick={() => { onModeChange('range'); setShowCustom(false); }}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              !isSingle ? 'bg-primary/10 text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Date Range
          </button>
        </div>

        {isSingle ? (
          /* Single date: scrollable list of available dates */
          <div className="max-h-[300px] overflow-y-auto p-1">
            {availableDates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No reports found</p>
            ) : (
              availableDates.map((date) => {
                const isSelected = date === dateSelection.singleDate;
                let label = date;
                try { label = format(parseISO(date), 'EEEE, MMM d, yyyy'); } catch {}
                return (
                  <button
                    key={date}
                    onClick={() => { onDateChange(date); setIsOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })
            )}
          </div>
        ) : showCustom ? (
          /* Custom range: calendar pickers */
          <div className="p-3 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Start Date</p>
              <Calendar
                mode="single"
                selected={customStart}
                onSelect={setCustomStart}
                className="rounded-md border"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">End Date</p>
              <Calendar
                mode="single"
                selected={customEnd}
                onSelect={setCustomEnd}
                className="rounded-md border"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowCustom(false)}>
                Back
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={!customStart || !customEnd}
                onClick={handleApplyCustom}
              >
                Apply
              </Button>
            </div>
          </div>
        ) : (
          /* Range presets */
          <div className="p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Quick ranges</p>
            {presets.map(({ key, label }) => {
              const isSelected = dateSelection.preset === key;
              return (
                <button
                  key={key}
                  onClick={() => handlePreset(key)}
                  className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
