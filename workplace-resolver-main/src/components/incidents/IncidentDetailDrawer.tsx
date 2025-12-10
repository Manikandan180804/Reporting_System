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

interface IncidentDetailDrawerProps {
  incidentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export default function IncidentDetailDrawer({ incidentId, open, onOpenChange, onUpdated }: IncidentDetailDrawerProps) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const [responders, setResponders] = useState<User[]>([]);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId || !open) return;
    setLoading(true);
    Promise.all([
      api.getIncidentById(incidentId),
      api.getResponders(),
    ])
      .then(([inc, resp]) => {
        setIncident(inc);
        setResponders(resp);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [incidentId, open]);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      // if the updated incident matches current incident, reload
      if (detail && detail._id && detail._id === incidentId) {
        api.getIncidentById(incidentId!).then(setIncident).catch(() => {});
      }
    };

    const onComment = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (detail && detail.incidentId && detail.incidentId === incidentId) {
        api.getIncidentById(incidentId!).then(setIncident).catch(() => {});
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
    api.getIncidentById(incidentId).then(setIncident).catch(() => {});
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
      <DialogContent className="w-[90vw] max-w-4xl">
        <DialogHeader>
          <DialogTitle>Incident Details</DialogTitle>
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
