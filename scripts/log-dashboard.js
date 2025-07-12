const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.LOG_DASHBOARD_PORT || 4000;

// Optional: Set a password for access (set LOG_DASHBOARD_PASSWORD env var)
const PASSWORD = process.env.LOG_DASHBOARD_PASSWORD || null;

// Middleware for basic password protection
app.use((req, res, next) => {
  if (PASSWORD) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${PASSWORD}`) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).send('Unauthorized: Set LOG_DASHBOARD_PASSWORD env var and use Authorization: Bearer <password>');
    }
  }
  next();
});

app.get('/', (req, res) => {
  res.redirect('/logs');
});

app.get('/logs', (req, res) => {
  const logFile = path.resolve(__dirname, '../logs.txt');
  if (!fs.existsSync(logFile)) {
    return res.status(404).send('Log file not found.');
  }
  const query = req.query.q ? req.query.q.toLowerCase() : null;
  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
  let filtered = lines;
  if (query) {
    filtered = lines.filter(line => line.toLowerCase().includes(query));
  }
  // Show most recent first
  filtered = filtered.reverse();
  res.send(`
    <html>
      <head>
        <title>Asylum Bot Error Log Dashboard</title>
        <style>
          body { font-family: monospace; background: #181a1b; color: #e0e0e0; padding: 2em; }
          input[type=text] { width: 300px; }
          pre { background: #23272a; padding: 1em; border-radius: 6px; }
          .logline { margin-bottom: 0.5em; }
        </style>
      </head>
      <body>
        <h1>Asylum Bot Error Log Dashboard</h1>
        <form method="get" action="/logs">
          <input type="text" name="q" placeholder="Search trace ID, context, date..." value="${query || ''}" />
          <button type="submit">Search</button>
          <a href="/logs/download" style="margin-left:2em;color:#00bfff;">Download Full Log</a>
        </form>
        <hr/>
        <pre>
${filtered.map(line => `<div class="logline">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('\n')}
        </pre>
        <p style="color:#888;">Showing ${filtered.length} of ${lines.length} log lines.</p>
      </body>
    </html>
  `);
});

app.get('/logs/download', (req, res) => {
  const logFile = path.resolve(__dirname, '../logs.txt');
  if (!fs.existsSync(logFile)) {
    return res.status(404).send('Log file not found.');
  }
  res.download(logFile, 'logs.txt');
});

app.listen(PORT, () => {
  console.log(`Log dashboard running at http://localhost:${PORT}/logs`);
  if (PASSWORD) {
    console.log('Dashboard is password protected.');
  }
}); 