import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('src/pages/DebugAuthPage.jsx','utf8');
const ctx=fs.readFileSync('src/context/AuthContext.jsx','utf8');
const app=fs.readFileSync('src/App.jsx','utf8');
test('V208 inspector reads isAuthenticated as a boolean, never calls it',()=>{
  assert.match(ctx,/\bisAuthenticated\s*,/);
  assert.doesNotMatch(page,/\bauth\.isAuthenticated\s*\(/);
  assert.match(page,/auth\.isAuthenticated\s*\?/);
});
test('V208 debug route remains strictly restricted to general admin',()=>{
  assert.match(app,/<Route path="\/debug-auth" element=\{<ProtectedRoute requiredRole=\{ROLE_TYPES\.ADMIN_GENERAL\}>/);
});
