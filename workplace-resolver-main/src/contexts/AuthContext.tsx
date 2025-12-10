import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { connectSocket, on as socketOn } from '@/services/socket';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getCurrentUser()
        .then(async (u) => {
          setUser(u);
          // connect socket if available
          const sock = await connectSocket();
          if (sock) {
            socketOn('incident:updated', (payload: any) => {
              window.dispatchEvent(new CustomEvent('socket:incident.updated', { detail: payload }));
            });
            socketOn('comment:added', (payload: any) => {
              window.dispatchEvent(new CustomEvent('socket:comment.added', { detail: payload }));
            });
            socketOn('incident:assigned', (payload: any) => {
              window.dispatchEvent(new CustomEvent('socket:incident.assigned', { detail: payload }));
            });
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login({ email, password });
      localStorage.setItem('token', response.token);
      setUser(response.user);
      toast({
        title: 'Login successful',
        description: `Welcome back, ${response.user.name}!`,
      });
      // connect socket after login
      connectSocket().then((sock) => {
        if (sock) {
          socketOn('incident:updated', (payload: any) => {
            window.dispatchEvent(new CustomEvent('socket:incident.updated', { detail: payload }));
          });
          socketOn('comment:added', (payload: any) => {
            window.dispatchEvent(new CustomEvent('socket:comment.added', { detail: payload }));
          });
          socketOn('incident:assigned', (payload: any) => {
            window.dispatchEvent(new CustomEvent('socket:incident.assigned', { detail: payload }));
          });
        }
      }).catch(() => {});
    } catch (error) {
      toast({
        title: 'Login failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string, role: string) => {
    try {
      const response = await api.signup({ email, password, name, role: role as any });
      localStorage.setItem('token', response.token);
      setUser(response.user);
      toast({
        title: 'Account created',
        description: 'Welcome to the incident reporting system!',
      });
    } catch (error) {
      toast({
        title: 'Signup failed',
        description: error instanceof Error ? error.message : 'Could not create account',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast({
      title: 'Logged out',
      description: 'You have been logged out successfully',
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
