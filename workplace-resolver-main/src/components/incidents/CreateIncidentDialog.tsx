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
import { AlertCircle, CheckCircle, AlertTriangle, Sparkles, Brain, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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
  aiPowered?: boolean;
}

interface AITriagePrediction {
  category: string;
  severity: string;
  categoryConfidence: number;
  severityConfidence: number;
  assignedTeam: string;
  aiPowered: boolean;
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
  const [aiGeneratedSolutions, setAiGeneratedSolutions] = useState<string[]>([]);
  const [anomalyWarning, setAnomalyWarning] = useState<string | null>(null);

  // AI Triage Prediction State
  const [aiPrediction, setAiPrediction] = useState<AITriagePrediction | null>(null);
  const [predictingTriage, setPredictingTriage] = useState(false);

  const { toast } = useToast();

  // Check for duplicates and get AI triage prediction as user types
  useEffect(() => {
    if (!title || !description || title.length < 5 || description.length < 10) {
      setDuplicateWarning(null);
      setAiPrediction(null);
      return;
    }

    const timer = setTimeout(async () => {
      // Check duplicates
      setCheckingDuplicate(true);
      try {
        const data = await api.checkDuplicate(title, description);
        setDuplicateWarning(data.hasDuplicates ? data : null);
      } catch (err) {
        console.error('Duplicate check failed:', err);
      } finally {
        setCheckingDuplicate(false);
      }

      // Get AI triage prediction
      setPredictingTriage(true);
      try {
        const data = await api.predictTriage(title, description);
        if (data.success && data.prediction) {
          setAiPrediction(data.prediction);
        }
      } catch (err) {
        console.error('AI prediction failed:', err);
      } finally {
        setPredictingTriage(false);
      }
    }, 800); // Debounce 800ms

    return () => clearTimeout(timer);
  }, [title, description]);

  // Apply AI suggestion
  const applyAiSuggestion = () => {
    if (aiPrediction) {
      // Map AI category to form values
      const categoryMap: Record<string, string> = {
        'infrastructure': 'IT',
        'application': 'IT',
        'security': 'IT',
        'database': 'IT',
        'other': 'Facility',
      };

      // Map AI severity to form values
      const severityMap: Record<string, string> = {
        'critical': 'Critical',
        'high': 'High',
        'medium': 'Medium',
        'low': 'Low',
      };

      setCategory(categoryMap[aiPrediction.category] || 'IT');
      setSeverity(severityMap[aiPrediction.severity] || 'Medium');

      toast({
        title: '✨ AI Suggestion Applied',
        description: `Category: ${categoryMap[aiPrediction.category] || 'IT'}, Severity: ${severityMap[aiPrediction.severity] || 'Medium'}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { incident, aiInsights } = await api.createIncidentWithInsights({
        title,
        description,
        category: category || undefined,
        severity: severity || undefined,
      } as any);

      // Store suggestions for later display
      if (aiInsights?.suggestedSolutions) {
        setSuggestedSolutions(aiInsights.suggestedSolutions);
      }
      if (aiInsights?.aiGeneratedSolutions) {
        setAiGeneratedSolutions(aiInsights.aiGeneratedSolutions);
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
        title: '✅ Incident Created',
        description: aiInsights?.triage?.aiPowered
          ? '🤖 AI-powered triage applied automatically'
          : 'Incident reported successfully',
      });

      setTitle('');
      setDescription('');
      setCategory('');
      setSeverity('');
      setFiles(null);
      setDuplicateWarning(null);
      setSuggestedSolutions([]);
      setAiGeneratedSolutions([]);
      setAnomalyWarning(null);
      setAiPrediction(null);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Report New Incident
            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </DialogTitle>
          <DialogDescription>Submit a new workplace incident for review. AI will help classify and route it.</DialogDescription>
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

          {/* AI Triage Prediction Card */}
          {(predictingTriage || aiPrediction) && (
            <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                {predictingTriage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                ) : (
                  <Brain className="w-4 h-4 text-purple-600" />
                )}
                <span className="font-semibold text-purple-800 text-sm">
                  {predictingTriage ? 'AI Analyzing...' : '🤖 AI Prediction'}
                </span>
                {aiPrediction?.aiPowered && (
                  <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-600">
                    HuggingFace
                  </Badge>
                )}
              </div>

              {aiPrediction && !predictingTriage && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div className="bg-white/60 rounded-md p-2">
                      <div className="text-xs text-gray-500">Category</div>
                      <div className="font-medium capitalize">{aiPrediction.category}</div>
                      <div className="text-xs text-purple-600">{aiPrediction.categoryConfidence}% confidence</div>
                    </div>
                    <div className="bg-white/60 rounded-md p-2">
                      <div className="text-xs text-gray-500">Severity</div>
                      <div className="font-medium capitalize">{aiPrediction.severity}</div>
                      <div className="text-xs text-purple-600">{aiPrediction.severityConfidence}% confidence</div>
                    </div>
                  </div>

                  {aiPrediction.assignedTeam && (
                    <div className="text-xs text-gray-600 mb-3">
                      Suggested Team: <span className="font-medium">{aiPrediction.assignedTeam}</span>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={applyAiSuggestion}
                    className="w-full bg-white hover:bg-purple-50 border-purple-200 text-purple-700"
                  >
                    <Sparkles className="w-3 h-3 mr-2" />
                    Apply AI Suggestion
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Duplicate Warning Alert */}
          {duplicateWarning && (
            <Alert className="border-yellow-300 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="font-semibold mb-2 flex items-center gap-2">
                  {duplicateWarning.message}
                  {duplicateWarning.aiPowered && (
                    <Badge variant="outline" className="text-[10px]">AI</Badge>
                  )}
                </div>
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
              <Label htmlFor="category" className="flex items-center gap-2">
                Category
                {category && aiPrediction && (
                  <span className="text-[10px] text-gray-400">(AI suggested)</span>
                )}
              </Label>
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
              <Label htmlFor="severity" className="flex items-center gap-2">
                Severity
                {severity && aiPrediction && (
                  <span className="text-[10px] text-gray-400">(AI suggested)</span>
                )}
              </Label>
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

          {/* Suggested Solutions from Similar Issues */}
          {suggestedSolutions.length > 0 && (
            <Alert className="border-green-300 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="font-semibold mb-2">📚 Solutions from Similar Issues:</div>
                <div className="space-y-2 text-sm">
                  {suggestedSolutions.map((sol, idx) => (
                    <div key={idx} className="border-t border-green-200 pt-2 first:border-0 first:pt-0">
                      <strong>{sol.sourceTitle}</strong>
                      {sol.solutions?.map((s: string, i: number) => (
                        <div key={i} className="text-xs ml-2">• {s}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* AI Generated Solutions */}
          {aiGeneratedSolutions.length > 0 && (
            <Alert className="border-blue-300 bg-blue-50">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="font-semibold mb-2">🤖 AI-Generated Solutions:</div>
                <div className="space-y-1 text-sm">
                  {aiGeneratedSolutions.map((sol, idx) => (
                    <div key={idx} className="text-xs">
                      {idx + 1}. {sol}
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

          <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Submit with AI Triage
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

