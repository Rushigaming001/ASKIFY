import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface ClearAllMessagesButtonProps {
  chatType: 'public' | 'friends';
  onCleared?: () => void;
}

export function ClearAllMessagesButton({ chatType, onCleared }: ClearAllMessagesButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClearAll = async () => {
    setLoading(true);
    try {
      const table = chatType === 'public' ? 'public_messages' : 'friends_chat_messages';
      
      // Delete all messages from the table
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (workaround for no .deleteAll())

      if (error) throw error;

      toast.success(`All ${chatType} chat messages have been cleared!`);
      setOpen(false);
      onCleared?.();
    } catch (error: any) {
      console.error('Error clearing messages:', error);
      toast.error('Failed to clear messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive" title="Clear All Messages">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Clear All {chatType === 'public' ? 'Public' : 'Friends'} Chat Messages?
          </DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-2">
            <p>
              This action will <span className="font-bold text-destructive">permanently delete</span> all messages in the {chatType === 'public' ? 'public' : 'friends'} chat.
            </p>
            <p className="text-sm text-muted-foreground">
              ⚠️ This action cannot be undone. All users will lose access to these messages.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleClearAll} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Yes, Clear All
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
