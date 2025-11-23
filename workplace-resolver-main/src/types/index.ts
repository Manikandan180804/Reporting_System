export type UserRole = 'employee' | 'responder' | 'admin';

export type IncidentCategory = 'IT' | 'HR' | 'Facility';

export type IncidentStatus = 'Open' | 'Investigating' | 'Resolved';

export type SeverityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface User {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  createdAt: string;
}

export interface Incident {
  _id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  severity: SeverityLevel;
  status: IncidentStatus;
  reportedBy: string;
  reporterName: string;
  assignedTo?: string;
  assigneeName?: string;
  assignedTeam?: string;
  statusHistory?: {
    fromStatus?: string | null;
    toStatus: string;
    changedBy?: string;
    changedByName?: string;
    note?: string;
    changedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
}

export interface Comment {
  _id: string;
  incidentId: string;
  userId: string;
  userName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface RoutingRule {
  _id: string;
  category: IncidentCategory;
  assignedTeam: string;
  assignedTo?: string;
  priority?: number;
  active?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  department?: string;
}
