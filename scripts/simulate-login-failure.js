// Use global fetch (Node 18+) to avoid depending on axios installation
const { URL } = require('url');

async function simulate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch('http://localhost:5000/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrong' }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      // try to parse JSON body for message
      let data = null;
      try { data = await res.json(); } catch (e) { /* ignore parse errors */ }
      const message = data?.message || res.statusText || 'Login failed';
      console.log('Simulated frontend alert message:');
      console.log(message);
      console.log('\nError summary:', { status: res.status });
      return;
    }

    const data = await res.json();
    console.log('Unexpected success', data);
  } catch (err) {
    const message = err?.message || 'Login failed';
    console.log('Simulated frontend alert message:');
    console.log(message);
    console.log('\nError summary:', { code: err.code || null });
  }
}

simulate();
