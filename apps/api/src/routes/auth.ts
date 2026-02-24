/**
 * Auth route — proxies the Cognito token exchange so the client secret
 * never has to leave the backend. The extension sends the auth code +
 * PKCE verifier here; we attach the client secret and call Cognito.
 */
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN || '';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || '';

const bodySchema = z.object({
  code: z.string(),
  redirectUri: z.string(),
  codeVerifier: z.string(),
});

router.post('/token', async (req, res) => {
  if (!COGNITO_DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'Cognito not configured on server' });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Missing code, redirectUri, or codeVerifier' });
  }

  const { code, redirectUri, codeVerifier } = parsed.data;

  const tokenRes = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return res.status(400).json({ error: `Cognito token exchange failed: ${err}` });
  }

  const { id_token, access_token, expires_in } = await tokenRes.json() as any;
  res.json({ idToken: id_token, accessToken: access_token, expiresIn: expires_in });
});

export { router as authRouter };
