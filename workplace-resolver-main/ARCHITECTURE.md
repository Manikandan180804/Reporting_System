# Incident Reporting System - Architecture Documentation

## Overview
This is a React-based frontend application for an incident reporting system that connects to an external MongoDB backend via REST APIs.

## Technology Stack
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State Management**: React Context API + TanStack Query
- **Forms**: React Hook Form (available)
- **Backend**: External MongoDB + Express API (not included)

## Project Structure

```
src/
├── components/
│   ├── admin/              # Admin-specific components
│   │   └── CreateRoutingRuleDialog.tsx
│   ├── dashboards/         # Role-based dashboard views
│   │   ├── AdminDashboard.tsx
│   │   ├── EmployeeDashboard.tsx
│   │   └── ResponderDashboard.tsx
│   ├── incidents/          # Incident-related components
│   │   └── CreateIncidentDialog.tsx
│   ├── layout/             # Layout components
│   │   └── DashboardLayout.tsx
│   └── ui/                 # Reusable UI components (shadcn)
├── contexts/
│   └── AuthContext.tsx     # Authentication state management
├── pages/
│   ├── Dashboard.tsx       # Role-based dashboard router
│   ├── Index.tsx           # Landing page
│   ├── Login.tsx           # Login page
│   ├── Signup.tsx          # Registration page
│   └── NotFound.tsx        # 404 page
├── services/
│   └── api.ts              # API service layer
├── types/
│   └── index.ts            # TypeScript type definitions
└── App.tsx                 # Root component with routing

```

## User Roles & Permissions

### 1. Employee
- Submit new incidents with category, severity, and description
- View their own incident history
- Track status updates on their incidents

### 2. Responder
- View all incidents assigned to them
- Update incident status: Open → Investigating → Resolved
- Add internal comments for documentation

### 3. Admin
- Configure routing rules by category
- View all users in the system
- Manage team assignments

## Data Models

### User
```typescript
{
  _id: string;
  email: string;
  name: string;
  role: 'employee' | 'responder' | 'admin';
  department?: string;
  createdAt: string;
}
```

### Incident
```typescript
{
  _id: string;
  title: string;
  description: string;
  category: 'IT' | 'HR' | 'Facility';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Investigating' | 'Resolved';
  reportedBy: string;
  reporterName: string;
  assignedTo?: string;
  assigneeName?: string;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
}
```

### RoutingRule
```typescript
{
  _id: string;
  category: 'IT' | 'HR' | 'Facility';
  assignedTeam: string;
  assignedTo?: string;
  createdAt: string;
}
```

## API Integration

The frontend expects the following API endpoints from your MongoDB backend:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `GET /api/auth/me` - Get current user

### Incidents
- `POST /api/incidents` - Create incident
- `GET /api/incidents` - Get all incidents (with filters)
- `GET /api/incidents/:id` - Get incident by ID
- `PATCH /api/incidents/:id/status` - Update incident status
- `GET /api/incidents/my-incidents` - Get user's incidents
- `GET /api/incidents/assigned` - Get assigned incidents (responders)
- `POST /api/incidents/:id/comments` - Add comment to incident

### Routing Rules
- `GET /api/routing-rules` - Get all routing rules
- `POST /api/routing-rules` - Create routing rule
- `PATCH /api/routing-rules/:id` - Update routing rule
- `DELETE /api/routing-rules/:id` - Delete routing rule

### Users
- `GET /api/users` - Get all users
- `GET /api/users/responders` - Get all responders

## Authentication Flow

1. User logs in via `/login` or signs up via `/signup`
2. Backend returns JWT token and user object
3. Token is stored in localStorage
4. Token is sent with all subsequent API requests via Authorization header
5. AuthContext manages authentication state globally
6. Protected routes redirect to login if not authenticated

## Routing Rules Logic

Admins can configure routing rules that automatically assign incidents to teams/responders based on category:

Example:
- IT → IT Support Team → John Doe (responder)
- HR → HR Team → Jane Smith (responder)
- Facility → Maintenance Team → Bob Johnson (responder)

This logic should be implemented in your backend when an incident is created.

## Environment Setup

1. Copy `.env.example` to `.env`
2. Set `VITE_API_URL` to your MongoDB backend URL
3. Run `npm install`
4. Run `npm run dev`

## Backend Requirements

Your MongoDB backend should:

1. **Implement JWT authentication**
   - Generate tokens on login/signup
   - Verify tokens on protected routes

2. **Implement routing logic**
   - When an incident is created, check routing rules
   - Auto-assign to appropriate team/responder based on category

3. **Implement status workflow**
   - Validate status transitions (Open → Investigating → Resolved)
   - Track status change history

4. **Implement role-based access control**
   - Employees: Can only see their own incidents
   - Responders: Can see assigned incidents
   - Admins: Can see all data

5. **Handle CORS**
   - Allow requests from frontend origin

## Design System

The app uses semantic tokens for consistent theming:
- `--primary`: Main brand color (blue)
- `--destructive`: Error/critical states (red)
- `--muted`: Background surfaces
- `--foreground`: Text colors

All components use these tokens to support light/dark mode automatically.

## Testing Considerations

When building your backend, test:
1. Routing rule application on incident creation
2. Status update workflow validation
3. Role-based access control
4. JWT token expiration handling
5. Input validation and sanitization

## Security Notes

- Never store sensitive data in frontend code
- All authentication happens server-side
- Role checks must be enforced on backend
- Validate all inputs on backend
- Use HTTPS in production
- Implement rate limiting on backend
- Hash passwords with bcrypt
- Use secure JWT secrets

## Future Enhancements

Potential features to add:
- File attachments for incidents
- Email notifications
- Real-time updates (WebSockets)
- Advanced filtering and search
- Analytics dashboard
- Audit logs
- Bulk operations
- Export to CSV/PDF
