// Module-level stores shared across OAuth routes (single-process Electron app)
export const pkceStore = new Map<string, { verifier: string; clientId: string; expiresAt: number }>();
export const tokenPickupStore = new Map<string, { accessToken: string; expiresAt: number }>();
