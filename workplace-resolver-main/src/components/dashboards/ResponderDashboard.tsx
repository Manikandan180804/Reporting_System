import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Incident } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';

export default function ResponderDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await api.getAssignedIncidents();
      setIncidents(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load assigned incidents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedIncident || !newStatus) return;

    try {
      await api.updateIncidentStatus(selectedIncident._id, newStatus);
      if (comment.trim()) {
        await api.addComment(selectedIncident._id, comment, true);
      }
      toast({
        title: 'Success',
        description: 'Incident updated successfully',
      });
      setComment('');
      setNewStatus('');
      setSelectedIncident(null);
      loadIncidents();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update incident',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'Investigating':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-500/20';
      case 'Resolved':
        return 'bg-green-500/10 text-green-700 dark:text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Responder Console</h1>
          <p className="text-muted-foreground">Manage your assigned incidents</p>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading incidents...</div>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No incidents assigned to you</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Assigned Incidents</h2>
              {incidents.map((incident) => (
                <Card
                  key={incident._id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedIncident?._id === incident._id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedIncident(incident)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{incident.title}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(incident.status)}>
                        {incident.status}
                      </Badge>
                    </div>
                    <CardDescription>{incident.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div>
                        <Badge variant="outline">{incident.category}</Badge>
                      </div>
                      <div>Severity: {incident.severity}</div>
                      <div>By: {incident.reporterName}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div>
              {selectedIncident ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Update Incident</CardTitle>
                    <CardDescription>Change status and add internal comments</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Current Status</Label>
                      <Badge variant="outline" className={getStatusColor(selectedIncident.status)}>
                        {selectedIncident.status}
                      </Badge>
                    </div>

                    {/** Assignment info */}
                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <div className="text-sm">
                        {selectedIncident.assigneeName ? (
                          <span className="font-medium">{selectedIncident.assigneeName}</span>
                        ) : selectedIncident.assignedTeam ? (
                          <span className="text-muted-foreground">Team: {selectedIncident.assignedTeam}</span>
                        ) : (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </div>
                    </div>

                    {selectedIncident.statusHistory && selectedIncident.statusHistory.length > 0 && (
                      <div className="space-y-2">
                        <Label>Status History</Label>
                        <div className="text-sm space-y-1 max-h-48 overflow-auto">
                          {selectedIncident.statusHistory
                            .slice()
                            .reverse()
                            .map((h, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <div className="w-36 text-xs text-muted-foreground">
                                  {new Date(h.changedAt).toLocaleString()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{(h.fromStatus ?? '—') + ' → ' + h.toStatus}</div>
                                  <div className="text-xs text-muted-foreground">{h.changedByName || h.changedBy || ''}{h.note ? ` — ${h.note}` : ''}</div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="status">New Status</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger id="status">
                          <SelectValue placeholder="Select new status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Investigating">Investigating</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="comment">Internal Comment (Optional)</Label>
                      <Textarea
                        id="comment"
                        placeholder="Add notes about the investigation or resolution..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <Button onClick={handleUpdateStatus} disabled={!newStatus} className="w-full">
                      Update Incident
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="mb-4 h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">Select an incident to update</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
