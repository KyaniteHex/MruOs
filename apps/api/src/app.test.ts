import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const app = createApp({
  sessionSecret: 'stage-five-test-secret-value-32-chars',
});

describe('GET /health', () => {
  it('returns the API health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
