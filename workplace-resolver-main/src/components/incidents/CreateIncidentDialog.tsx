import { useState } from 'react';
import { api } from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface CreateIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CreateIncidentDialog({ open, onOpenChange, onSuccess }: CreateIncidentDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const created = await api.createIncident({
        title,
        description,
        category: category as any,
        severity: severity as any,
      });

      // Upload any selected files after incident creation
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          try {
            await api.uploadAttachment(created._id, f);
          } catch (err) {
            console.error('Attachment upload failed', err);
          }
        }
      }

      toast({
        title: 'Success',
        description: 'Incident reported successfully',
      });

      setTitle('');
      setDescription('');
      setCategory('');
      setSeverity('');
      setFiles(null);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create incident',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report New Incident</DialogTitle>
          <DialogDescription>Submit a new workplace incident for review</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Brief description of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Provide detailed information about the incident"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Facility">Facility</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select value={severity} onValueChange={setSeverity} required>
                <SelectTrigger id="severity">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachments">Attachments (optional)</Label>
            <input
              id="attachments"
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="text-sm"
            />
            {files && files.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {Array.from(files).map((f, idx) => (
                  <div key={idx}>{f.name}</div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Incident'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
