import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Incident } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CreateIncidentDialog from '@/components/incidents/CreateIncidentDialog';
import { useToast } from '@/hooks/use-toast';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await api.getMyIncidents();
      setIncidents(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load incidents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-destructive text-destructive-foreground';
      case 'High':
        return 'bg-orange-500 text-white';
      case 'Medium':
        return 'bg-yellow-500 text-white';
      case 'Low':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Incidents</h1>
            <p className="text-muted-foreground">View and manage your reported incidents</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Report Incident
          </Button>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading incidents...</div>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No incidents reported yet</p>
              <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
                Report Your First Incident
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {incidents.map((incident) => (
              <Card key={incident._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{incident.title}</CardTitle>
                    <Badge className={getSeverityColor(incident.severity)}>{incident.severity}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{incident.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Category:</span>
                      <Badge variant="outline">{incident.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className={getStatusColor(incident.status)}>
                        {incident.status}
                      </Badge>
                    </div>
                    {incident.assigneeName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Assigned to:</span>
                        <span className="font-medium">{incident.assigneeName}</span>
                      </div>
                    )}
                    {(!incident.assigneeName && incident.assignedTeam) && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Assigned team:</span>
                        <span className="font-medium">{incident.assignedTeam}</span>
                      </div>
                    )}

                    {incident.statusHistory && incident.statusHistory.length > 0 && (
                      <div className="pt-2 text-xs text-muted-foreground">
                        <div>Last update: {new Date(incident.statusHistory[incident.statusHistory.length - 1].changedAt).toLocaleString()}</div>
                        <div className="mt-1">
                          <button
                            className="text-sm text-primary underline"
                            onClick={() => setExpandedId(expandedId === incident._id ? null : incident._id)}
                          >
                            {expandedId === incident._id ? 'Hide history' : 'View history'}
                          </button>
                        </div>
                      </div>
                    )}

                    {expandedId === incident._id && incident.statusHistory && (
                      <div className="mt-3 text-xs max-h-40 overflow-auto space-y-2">
                        {incident.statusHistory.slice().reverse().map((h, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <div className="w-36 text-muted-foreground">{new Date(h.changedAt).toLocaleString()}</div>
                            <div>
                              <div className="font-medium">{(h.fromStatus ?? '—') + ' → ' + h.toStatus}</div>
                              <div className="text-muted-foreground text-xs">{h.changedByName || h.changedBy}{h.note ? ` — ${h.note}` : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 text-xs text-muted-foreground">
                      Created {new Date(incident.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateIncidentDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={loadIncidents} />
    </DashboardLayout>
  );
}
