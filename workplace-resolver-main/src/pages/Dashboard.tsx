import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import EmployeeDashboard from '@/components/dashboards/EmployeeDashboard';
import ResponderDashboard from '@/components/dashboards/ResponderDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      {user.role === 'employee' && <EmployeeDashboard />}
      {user.role === 'responder' && <ResponderDashboard />}
      {user.role === 'admin' && <AdminDashboard />}
    </>
  );
}
