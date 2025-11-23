# Backend

This folder contains the Express + Mongoose backend for IssueFlow.

## Environment
Copy `.env.example` to a `.env` file in the `backend/` folder and set your `MONGO_URI` and `JWT_SECRET`.

## Seed a test user
The repo includes `scripts/seed-user.js` for quickly creating a test user.

Run it like this:

```powershell
cd backend
npm install
# Create a test user with defaults (email: test@example.com, password: password123)
node scripts/seed-user.js
```

To supply a custom seeded email/password, set env vars before running:

```powershell
$env:SEED_EMAIL='admin@example.com'; $env:SEED_PASSWORD='mySecret'; node scripts/seed-user.js
```

After seeding you can login through the frontend at `/login` using created credentials.
