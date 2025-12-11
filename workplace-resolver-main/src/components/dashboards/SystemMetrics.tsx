import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle } from 'lucide-react';

export default function SystemMetrics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMetrics()
      .then((data) => setMetrics(data))
      .catch((err) => console.error('Failed to load metrics', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading metrics...</div>;
  if (!metrics) return <div>No metrics available</div>;

  const colors = {
    Open: '#ef4444',
    Investigating: '#eab308',
    Resolved: '#22c55e',
    Critical: '#dc2626',
    High: '#ea580c',
    Medium: '#eab308',
    Low: '#3b82f6',
  };

  // Format forecast data
  const forecastData = metrics.forecast?.nextDays?.map((count: number, idx: number) => ({
    day: `Day ${idx + 1}`,
    predicted: count,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.volume?.reduce((sum: number, v: any) => sum + v.count, 0) || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg Time to Resolve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(metrics.mttr / 3600000).toFixed(1)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.byStatus?.find((s: any) => s.status === 'Open')?.count || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Anomalies Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              {metrics.anomalies?.count || 0}
              {(metrics.anomalies?.count || 0) > 0 && <AlertTriangle className="h-6 w-6 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{metrics.anomalies?.percentage}% of all incidents</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incidents by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.byStatus || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incidents by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.bySeverity || []}
                  dataKey="count"
                  nameKey="severity"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(metrics.bySeverity || []).map((entry: any) => (
                    <Cell key={entry.severity} fill={(colors as any)[entry.severity] || '#666'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {metrics.volume && metrics.volume.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Incident Volume Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.volume}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* AI Predictive Forecast */}
      {forecastData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              7-Day Incident Forecast
            </CardTitle>
            <CardDescription>
              Predicted ticket volume based on historical patterns · Trend: <span className="font-semibold capitalize">{metrics.forecast?.trend}</span> · Confidence: {Math.round((metrics.forecast?.confidence || 0) * 100)}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="predicted" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Predicted Incidents" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-sm text-muted-foreground">
              Historical average: <span className="font-semibold">{metrics.forecast?.avgHistorical}</span> incidents/day
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
