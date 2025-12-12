import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Incident, User } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import CommentFeed from './CommentFeed';
import { Brain, Sparkles, AlertTriangle, Lightbulb, Loader2, RefreshCw } from 'lucide-react';

interface IncidentDetailDrawerProps {
  incidentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

interface AIInsights {
  similarIncidents: any[];
  hasSimilar: boolean;
  solutions: any[];
  aiGeneratedSolutions: string[];
  hasSolutions: boolean;
  anomalyScore: number;
  isAnomalous: boolean;
  anomalyFlags: string[];
  recommendation: string | null;
}

export default function IncidentDetailDrawer({ incidentId, open, onOpenChange, onUpdated }: IncidentDetailDrawerProps) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const [responders, setResponders] = useState<User[]>([]);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);

  // AI Insights state
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    if (!incidentId || !open) return;
    setLoading(true);
    setAiInsights(null);
    Promise.all([
      api.getIncidentById(incidentId),
      api.getResponders(),
    ])
      .then(([inc, resp]) => {
        setIncident(inc);
        setResponders(resp);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [incidentId, open]);

  // Fetch AI Insights
  const fetchAiInsights = async () => {
    if (!incidentId) return;
    setLoadingInsights(true);
    try {
      const response = await fetch(`http://localhost:5000/api/incidents/${incidentId}/ai-insights`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAiInsights(data.insights);
        }
      }
    } catch (err) {
      console.error('Failed to fetch AI insights:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      // if the updated incident matches current incident, reload
      if (detail && detail._id && detail._id === incidentId) {
        api.getIncidentById(incidentId!).then(setIncident).catch(() => { });
      }
    };

    const onComment = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (detail && detail.incidentId && detail.incidentId === incidentId) {
        api.getIncidentById(incidentId!).then(setIncident).catch(() => { });
      }
    };

    window.addEventListener('socket:incident.updated', onUpdated as EventListener);
    window.addEventListener('socket:comment.added', onComment as EventListener);

    return () => {
      window.removeEventListener('socket:incident.updated', onUpdated as EventListener);
      window.removeEventListener('socket:comment.added', onComment as EventListener);
    };
  }, [incidentId]);

  const handleCommentAdded = () => {
    // reload incident to pick up comments/activity
    if (!incidentId) return;
    api.getIncidentById(incidentId).then(setIncident).catch(() => { });
    onUpdated?.();
  };

  const handleWatch = async () => {
    if (!incidentId) return;
    try {
      const updated = await api.watchIncident(incidentId);
      setIncident(updated);
    } catch (err) {
      console.error('Watch failed', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Incident Details
            {(incident as any)?.aiTriageData?.aiPowered && (
              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                <Sparkles className="w-3 h-3 mr-1" />
                AI-Triaged
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Full incident record and activity feed</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center text-muted-foreground mt-6">Loading incident...</div>
        ) : !incident ? (
          <div className="text-center text-muted-foreground mt-6">No incident selected.</div>
        ) : (
          <div className="grid grid-cols-3 gap-6 mt-4">
            <div className="col-span-2 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{incident.title}</h2>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Reported by {incident.reporterName} • {new Date(incident.createdAt).toLocaleString()}</div>
                  <Button variant="outline" size="sm" onClick={handleWatch}>
                    👁️ Watch
                  </Button>
                </div>
              </div>

              <div className="p-4 border rounded-md">
                <h3 className="font-semibold">Description</h3>
                <p className="mt-2 whitespace-pre-wrap">{incident.description}</p>
              </div>

              {/* AI Insights Panel */}
              <div className="p-4 border border-purple-200 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-800">AI Insights</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAiInsights}
                    disabled={loadingInsights}
                    className="border-purple-200 text-purple-700 hover:bg-purple-100"
                  >
                    {loadingInsights ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Analyze
                      </>
                    )}
                  </Button>
                </div>

                {/* AI Triage Data (stored with incident) */}
                {(incident as any)?.aiTriageData && (
                  <div className="mb-4 p-3 bg-white/60 rounded-md">
                    <div className="text-xs font-medium text-purple-700 mb-2">🎯 AI Triage Result</div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Category:</span>{' '}
                        <span className="font-medium capitalize">{(incident as any).aiTriageData.predictedCategory}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Severity:</span>{' '}
                        <span className="font-medium capitalize">{(incident as any).aiTriageData.predictedSeverity}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Confidence:</span>{' '}
                        <span className="font-medium">{Math.round(((incident as any).aiTriageData.triageConfidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Anomaly Warning */}
                {(incident as any)?.isAnomalous && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Anomalous Incident Detected
                    </div>
                    <div className="text-xs text-red-600">
                      Anomaly Score: {Math.round(((incident as any).anomalyScore || 0) * 100)}%
                    </div>
                    {(incident as any).anomalyFlags?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {(incident as any).anomalyFlags.map((flag: string, idx: number) => (
                          <div key={idx} className="text-xs text-red-600">{flag}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic AI Insights */}
                {aiInsights ? (
                  <div className="space-y-3">
                    {/* Similar Incidents */}
                    {aiInsights.hasSimilar && aiInsights.similarIncidents.length > 0 && (
                      <div className="p-3 bg-white/60 rounded-md">
                        <div className="text-xs font-medium text-purple-700 mb-2">🔗 Similar Incidents</div>
                        <div className="space-y-2">
                          {aiInsights.similarIncidents.map((sim, idx) => (
                            <div key={idx} className="text-sm flex justify-between items-center">
                              <span className="truncate flex-1">{sim.title}</span>
                              <Badge variant="outline" className="text-xs ml-2">
                                {Math.round(sim.similarity * 100)}% match
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Solutions */}
                    {aiInsights.hasSolutions && (
                      <div className="p-3 bg-white/60 rounded-md">
                        <div className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          Suggested Solutions
                        </div>
                        <div className="space-y-2">
                          {aiInsights.solutions.map((sol, idx) => (
                            <div key={idx} className="text-sm">
                              <div className="font-medium">{sol.sourceTitle}</div>
                              {sol.solutions?.map((s: string, i: number) => (
                                <div key={i} className="text-xs text-gray-600 ml-2">• {s}</div>
                              ))}
                            </div>
                          ))}
                          {aiInsights.aiGeneratedSolutions?.map((sol, idx) => (
                            <div key={`ai-${idx}`} className="text-xs text-gray-600">
                              <Sparkles className="w-3 h-3 inline mr-1 text-blue-500" />
                              {sol}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiInsights.recommendation && (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        💡 {aiInsights.recommendation}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-500 py-4">
                    Click "Analyze" to get AI-powered insights
                  </div>
                )}
              </div>

              {incident.attachments && incident.attachments.length > 0 && (
                <div className="p-4 border rounded-md">
                  <h3 className="font-semibold">Attachments</h3>
                  <div className="mt-2 space-y-2">
                    {incident.attachments.map((a: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3">
                        {a.url && (a.filename || '').match(/\.(png|jpg|jpeg|gif)$/i) ? (
                          <img src={a.url} alt={a.filename || 'attachment'} className="w-16 h-16 object-cover rounded" />
                        ) : (
                          <div className="w-16 h-16 flex items-center justify-center bg-muted text-muted-foreground rounded">File</div>
                        )}
                        <a className="text-sm text-primary hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.filename || a.url}</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Category</div>
                  <div className="font-medium">{incident.category}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Severity</div>
                  <div className="font-medium">{incident.severity}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="flex items-center gap-2">
                    <Badge>{incident.status}</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 border rounded">
                <h4 className="font-semibold">Status History</h4>
                <div className="mt-2 space-y-2">
                  {(incident.statusHistory || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No status changes recorded.</div>
                  ) : (
                    (incident.statusHistory || []).map((h, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="font-medium">{h.toStatus}</div>
                        <div className="text-muted-foreground text-xs">{h.changedByName || h.changedBy} • {new Date(h.changedAt).toLocaleString()}</div>
                        {h.note && <div className="mt-1">{h.note}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <aside className="col-span-1">
              <div className="p-3 border rounded-md space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Assignment</h4>
                  <div className="text-sm space-y-2">
                    <div>Assignee: {incident.assigneeName || 'Unassigned'}</div>
                    <div>Team: {incident.assignedTeam || '—'}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assign-to">Reassign to:</Label>
                  <Select value={assigningTo || ''} onValueChange={setAssigningTo}>
                    <SelectTrigger id="assign-to">
                      <SelectValue placeholder="Select responder" />
                    </SelectTrigger>
                    <SelectContent>
                      {responders.map((r) => (
                        <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!assigningTo || !incidentId) return;
                      try {
                        const updated = await api.assignIncident(incidentId, assigningTo);
                        setIncident(updated);
                        setAssigningTo(null);
                      } catch (err) {
                        console.error('Assign failed', err);
                      }
                    }}
                    disabled={!assigningTo}
                    className="w-full"
                  >
                    Assign
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="p-3 border rounded-md">
                  <h4 className="font-semibold">Activity</h4>
                  <div className="mt-2 text-sm space-y-2 max-h-48 overflow-auto">
                    {(incident as any).activity && (incident as any).activity.length > 0 ? (
                      ((incident as any).activity || []).slice().reverse().map((a: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-medium">{a.type}</div>
                          <div className="text-muted-foreground">{a.byName || a.by} • {new Date(a.at).toLocaleString()}</div>
                          {a.message && <div className="mt-1">{a.message}</div>}
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground text-sm">No activity yet.</div>
                    )}
                  </div>
                </div>

                <CommentFeed incidentId={incident._id} initialComments={incident.comments || []} onCommentAdded={handleCommentAdded} />
              </div>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

