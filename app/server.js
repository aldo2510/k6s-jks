const express = require('express');
const client = require('prom-client');
const app = express();
const register = new client.Registry();

// Default metrics (CPU, memory of the process, event loop lag, GC, etc.)
client.collectDefaultMetrics({ register });

// Custom histogram for request duration
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [50, 100, 200, 300, 400, 500, 750, 1000, 1500, 2000]
});
register.registerMetric(httpRequestDurationMicroseconds);

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

app.get('/', async (req, res) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  try {
    res.json({ ok: true, message: 'Hello from Lab25 API' });
  } finally {
    end({ route: '/', code: 200, method: 'GET' });
  }
});

// Simulate CPU/IO work with a controllable delay: /work?ms=250
app.get('/work', async (req, res) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  const ms = Math.max(0, Math.min(3000, parseInt(req.query.ms || '200', 10)));
  // Busy wait for ~ms/2 and sleep for ~ms/2 to mix CPU + IO
  const start = Date.now();
  while (Date.now() - start < ms/2) { Math.sqrt(Math.random()); }
  await sleep(ms/2);
  res.json({ ok: true, simulatedLatencyMs: ms });
  end({ route: '/work', code: 200, method: 'GET' });
});

// Expose Prometheus metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Lab25 API listening on :${port}`));
