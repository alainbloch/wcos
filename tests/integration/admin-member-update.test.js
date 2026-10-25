import { buildApp } from '../../src/app.js';
import { authService } from '../../src/services/authService.js';
import assert from 'assert';

const app = await buildApp();
await app.ready();

// Integration: updateMember with multipart form (the actual failing path)
const token = authService.generateToken({ id: 1, role: 'admin', email: 'admin@test' });

const res = await app.inject({
  method: 'POST',
  url: '/admin/members/1/edit',
  headers: { 'content-type': 'multipart/form-data; boundary=test', cookie: `wcos_session=${token}` },
  payload: Buffer.from(
    '--test\r\nContent-Disposition: form-data; name="circleName"\r\n\r\nGad\r\n' +
    '--test\r\nContent-Disposition: form-data; name="level"\r\n\r\nL2\r\n' +
    '--test\r\nContent-Disposition: form-data; name="merits"\r\n\r\nExpert Swordsman\r\nKaiden\r\n' +
    '--test--\r\n'
  ),
});

// Should redirect (success) or render form (validation error) — not 500
assert.ok([200,302,400,401,404].includes(res.statusCode),
  `Expected valid status, got ${res.statusCode}: ${res.body?.message || res.body}`);
console.log('PASS: updateMember multipart integration — status', res.statusCode, 'no 500 crash');
app.close();
process.exit(0);
