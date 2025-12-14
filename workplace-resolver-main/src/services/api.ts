import { AuthResponse, Comment, Incident, LoginCredentials, RoutingRule, SignupData, User } from '@/types';

// Use environment variable, fallback to production API if not set
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://issueflow-api.onrender.com/api';

class ApiService {
  private getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
          ...options.headers,
        },
      });
    } catch (err: any) {
      // Network-level error (DNS, ECONNREFUSED, CORS preflight failure in some browsers manifests as network error)
      throw new Error(`Network request failed for ${url}: ${err?.message || String(err)}`);
    }

    if (!response.ok) {
      // Try to parse JSON error body, but fall back to text
      const bodyText = await response.text().catch(() => '');
      let parsed: any = null;
      try {
        parsed = bodyText ? JSON.parse(bodyText) : null;
      } catch (e) {
        parsed = null;
      }
      const serverMessage = parsed?.message || parsed?.error || bodyText || `HTTP ${response.status}`;
      throw new Error(`Request to ${url} failed: ${serverMessage}`);
    }

    return response.json();
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async signup(data: SignupData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // Incident endpoints
  async createIncident(incident: Partial<Incident>): Promise<Incident> {
    return this.request<Incident>('/incidents', {
      method: 'POST',
      body: JSON.stringify(incident),
    });
  }

  async getIncidents(filters?: { status?: string; category?: string }): Promise<Incident[]> {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.request<Incident[]>(`/incidents?${params}`);
  }

  async getIncidentById(id: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}`);
  }

  async updateIncidentStatus(id: string, status: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getMyIncidents(): Promise<Incident[]> {
    return this.request<Incident[]>('/incidents/my-incidents');
  }

  async getAssignedIncidents(): Promise<Incident[]> {
    return this.request<Incident[]>('/incidents/assigned');
  }

  // Comment endpoints
  async addComment(incidentId: string, content: string, isInternal: boolean): Promise<Comment> {
    return this.request<Comment>(`/incidents/${incidentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, isInternal }),
    });
  }

  async uploadAttachment(incidentId: string, file: File): Promise<{ url: string }> {
    const url = `${API_BASE_URL}/incidents/${incidentId}/attachments`;
    const token = localStorage.getItem('token');
    const form = new FormData();
    form.append('file', file);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Upload failed: ${text || response.statusText}`);
    }

    return response.json();
  }

  async getActivity(incidentId: string): Promise<any[]> {
    return this.request<any[]>(`/incidents/${incidentId}/activity`);
  }

  // Routing rules endpoints
  async getRoutingRules(): Promise<RoutingRule[]> {
    return this.request<RoutingRule[]>('/routing-rules');
  }

  async createRoutingRule(rule: Partial<RoutingRule>): Promise<RoutingRule> {
    return this.request<RoutingRule>('/routing-rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateRoutingRule(id: string, rule: Partial<RoutingRule>): Promise<RoutingRule> {
    return this.request<RoutingRule>(`/routing-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(rule),
    });
  }

  async deleteRoutingRule(id: string): Promise<void> {
    return this.request<void>(`/routing-rules/${id}`, {
      method: 'DELETE',
    });
  }

  // User management endpoints
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async getResponders(): Promise<User[]> {
    return this.request<User[]>('/users/responders');
  }

  async watchIncident(id: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}/watch`, {
      method: 'POST',
    });
  }

  async assignIncident(id: string, userId: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo: userId }),
    });
  }

  async getMetrics(): Promise<any> {
    return this.request<any>('/incidents/metrics', { method: 'GET' });
  }
}

export const api = new ApiService();
