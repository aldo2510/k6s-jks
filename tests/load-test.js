import http from 'k6/http';
import { sleep, check, fail } from 'k6';

// ────────────────── Opciones ──────────────────
export const options = {
  thresholds: {
    // Globales
    http_req_failed: ['rate<0.01'],                 // <1% errores
    http_req_duration: ['p(95)<1000'],              // p95 < 1000 ms (ajústalo a tu SLO)

    // Por endpoint (nombre 'work')
    'http_req_duration{name:work}': ['p(95)<1000'],
  },
  stages: [
    { duration: '30s', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m',  target: 200 },
    { duration: '1m',  target: 200 },
    { duration: '30s', target: 0 },
  ],
};

// ────────────────── Target ──────────────────
// Requiere TARGET (ej: https://lab25-api-xxxx-uc.a.run.app)
// Si no está definido, fallamos para no correr contra un host equivocado.
const BASE_URL = __ENV.TARGET;
if (!BASE_URL) {
  fail('Falta la variable de entorno TARGET con la URL de Cloud Run.');
}

// ────────────────── Test ──────────────────
export default function () {
  const ms = 200 + Math.floor(Math.random() * 400); // 200–600ms
  const res = http.get(`${BASE_URL}/work?ms=${ms}`, { tags: { name: 'work' } });

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 0.3);
}
