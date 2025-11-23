require('dotenv').config();

const API = process.env.API_URL || 'http://localhost:5000/api';
const email = process.env.SEED_EMAIL || 'test@example.com';
const password = process.env.SEED_PASSWORD || 'password123';

async function main(){
  console.log('Logging in as', email);
  let res = await fetch(`${API}/users/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
  const login = await res.json();
  if (!res.ok) { console.error('Login failed', login); process.exit(1); }
  const token = login.token;
  console.log('Got token');

  // Create routing rule
  res = await fetch(`${API}/routing-rules`, { method: 'POST', headers: {'Content-Type':'application/json','Authorization': `Bearer ${token}`}, body: JSON.stringify({ category: 'IT', assignedTeam: 'IT Team' }) });
  const rule = await res.json();
  console.log('Create rule response:', rule);

  // Create incident
  res = await fetch(`${API}/incidents`, { method: 'POST', headers: {'Content-Type':'application/json','Authorization': `Bearer ${token}`}, body: JSON.stringify({ title: 'Auto-assign test', description: 'Testing auto-assignment', category: 'IT', severity: 'High' }) });
  const incident = await res.json();
  console.log('Create incident response:', JSON.stringify(incident, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
