import { useState, useEffect } from 'react';
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
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface DuplicateWarning {
  message: string;
  duplicates: Array<{
    issueId: string;
    title: string;
    similarity: number;
  }>;
}

export default function CreateIncidentDialog({ open, onOpenChange, onSuccess }: CreateIncidentDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [suggestedSolutions, setSuggestedSolutions] = useState<any[]>([]);
  const [anomalyWarning, setAnomalyWarning] = useState<string | null>(null);
  const { toast } = useToast();

  // Check for duplicates as user types
  useEffect(() => {
    if (!title || !description || title.length < 5) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const response = await fetch('http://localhost:5000/api/incidents/check-duplicate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ title, description }),
        });
        const data = await response.json();
        setDuplicateWarning(data.hasDuplicates ? data : null);
      } catch (err) {
        console.error('Duplicate check failed:', err);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 800); // Debounce 800ms

    return () => clearTimeout(timer);
  }, [title, description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title,
          description,
          category: category || undefined,
          severity: severity || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to create incident');

      const { incident, aiInsights } = await response.json();

      // Store suggestions for later display
      if (aiInsights?.suggestedSolutions) {
        setSuggestedSolutions(aiInsights.suggestedSolutions);
      }
      if (aiInsights?.anomaly) {
        setAnomalyWarning(aiInsights.anomaly.recommendation);
      }

      // Upload files
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          try {
            await api.uploadAttachment(incident._id, f);
          } catch (err) {
            console.error('Attachment upload failed', err);
          }
        }
      }

      toast({
        title: 'Success',
        description: 'Incident reported and intelligently routed',
      });

      setTitle('');
      setDescription('');
      setCategory('');
      setSeverity('');
      setFiles(null);
      setDuplicateWarning(null);
      setSuggestedSolutions([]);
      setAnomalyWarning(null);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create incident',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Duplicate Warning Alert */}
          {duplicateWarning && (
            <Alert className="border-yellow-300 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="font-semibold mb-2">{duplicateWarning.message}</div>
                <div className="space-y-1">
                  {duplicateWarning.duplicates.map((dup) => (
                    <div key={dup.issueId} className="text-sm">
                      • <strong>{dup.title}</strong> ({Math.round(dup.similarity * 100)}% match)
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Anomaly Warning Alert */}
          {anomalyWarning && (
            <Alert className="border-red-300 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Alert:</strong> {anomalyWarning}
              </AlertDescription>
            </Alert>
          )}

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

          {/* Suggested Solutions */}
          {suggestedSolutions.length > 0 && (
            <Alert className="border-green-300 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="font-semibold mb-2">💡 Suggested Solutions Found:</div>
                <div className="space-y-2 text-sm">
                  {suggestedSolutions.map((sol, idx) => (
                    <div key={idx} className="border-t border-green-200 pt-2 first:border-0 first:pt-0">
                      <strong>{sol.sourceTitle}</strong>
                      {sol.solutions.map((s: string, i: number) => (
                        <div key={i} className="text-xs ml-2">• {s}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

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
