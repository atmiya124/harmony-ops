'use client';

import { createAuthClient } from 'better-auth/react';

// Same-origin client for the /api/auth/* routes.
export const authClient = createAuthClient();
