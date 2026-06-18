/* global describe, expect, it */

import { GET } from './route';

describe('legacy Expo app shell route', () => {
  it('serves Superadmin-specific metadata for the Superadmin shell', async () => {
    const response = await GET(
      new Request('https://shii-edu.test/app/superadmin'),
      { params: Promise.resolve({ legacy: ['app', 'superadmin'] }) }
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>Shii-Edu Superadmin</title>');
    expect(html).toContain('/manifest-superadmin.webmanifest');
  });
});
