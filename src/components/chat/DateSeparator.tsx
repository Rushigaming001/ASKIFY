import { useMemo } from 'react';

interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const formattedDate = useMemo(() => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time parts for comparison
    const msgDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (msgDateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (msgDateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  }, [date]);

  return (
    <div className="flex items-center gap-3 py-5 select-none">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-border" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 py-1 rounded-full bg-muted/60 border border-border/50">
        {formattedDate}
      </span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border to-border" />
    </div>
  );
}

// Helper to check if dates are different days
export function isDifferentDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}
