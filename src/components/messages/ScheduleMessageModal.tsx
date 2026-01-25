import React, { useState } from 'react';
import { format, addMinutes, addHours, addDays, setHours, setMinutes } from 'date-fns';
import { Calendar, Clock, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ScheduleMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduledAt: Date) => void;
  messageContent: string;
}

const QUICK_OPTIONS = [
  { label: 'In 30 minutes', getValue: () => addMinutes(new Date(), 30) },
  { label: 'In 1 hour', getValue: () => addHours(new Date(), 1) },
  { label: 'In 3 hours', getValue: () => addHours(new Date(), 3) },
  { label: 'Tomorrow morning', getValue: () => {
    const tomorrow = addDays(new Date(), 1);
    return setMinutes(setHours(tomorrow, 9), 0);
  }},
  { label: 'Tomorrow evening', getValue: () => {
    const tomorrow = addDays(new Date(), 1);
    return setMinutes(setHours(tomorrow, 18), 0);
  }},
];

export const ScheduleMessageModal = ({
  isOpen,
  onClose,
  onSchedule,
  messageContent,
}: ScheduleMessageModalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleQuickOption = (getValue: () => Date) => {
    const date = getValue();
    setSelectedDate(date);
  };

  const handleCustomSubmit = () => {
    if (customDate && customTime) {
      const [hours, minutes] = customTime.split(':').map(Number);
      const date = new Date(customDate);
      date.setHours(hours, minutes, 0, 0);
      setSelectedDate(date);
    }
  };

  const handleSchedule = () => {
    if (selectedDate) {
      onSchedule(selectedDate);
      onClose();
    }
  };

  // Get min date (now) and min time for today
  const now = new Date();
  const minDate = format(now, 'yyyy-MM-dd');
  const minTime = customDate === minDate ? format(addMinutes(now, 5), 'HH:mm') : '00:00';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Schedule Message</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Preview */}
            {messageContent && (
              <div className="px-4 pt-3">
                <p className="text-xs text-muted-foreground mb-1">Message:</p>
                <p className="text-sm bg-muted/50 rounded-lg p-2 truncate">
                  {messageContent}
                </p>
              </div>
            )}

            {/* Quick Options */}
            <div className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Quick options:</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => handleQuickOption(option.getValue)}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg border transition-colors text-left",
                      selectedDate && format(selectedDate, 'PPp') === format(option.getValue(), 'PPp')
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom Time Toggle */}
              <button
                type="button"
                onClick={() => setShowCustom(!showCustom)}
                className="w-full text-sm text-primary hover:underline mt-2"
              >
                {showCustom ? 'Hide custom time' : 'Pick custom time'}
              </button>

              {/* Custom Date/Time Picker */}
              <AnimatePresence>
                {showCustom && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 pt-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Date</label>
                        <Input
                          type="date"
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                          min={minDate}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Time</label>
                        <Input
                          type="time"
                          value={customTime}
                          onChange={(e) => setCustomTime(e.target.value)}
                          min={minTime}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleCustomSubmit}
                      disabled={!customDate || !customTime}
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Set custom time
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Selected Time Display & Confirm */}
            {selectedDate && (
              <div className="px-4 pb-4 space-y-3">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Message will be sent:</p>
                  <p className="text-sm font-medium text-primary mt-1">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {format(selectedDate, 'h:mm a')}
                  </p>
                </div>
                <Button onClick={handleSchedule} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Schedule Message
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
