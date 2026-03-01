/**
 * Auth route — proxies Cognito API calls so the client secret never has to
 * leave the backend. Supports both PKCE token exchange and direct
 * USER_PASSWORD_AUTH sign-in/sign-up flows.
 *
 * Cognito app client requirement: enable "ALLOW_USER_PASSWORD_AUTH" in
 * AWS Console → Cognito → App clients → Auth flows.
 */
import { Router } from 'express';
import { z } from 'zod';
import { createHmac } from 'crypto';

const router = Router();

const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN || '';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || '';
const COGNITO_REGION = (process.env.COGNITO_DOMAIN || '').match(/\.(\w+-\w+-\d)\.amazoncognito/)?.[1] ?? 'us-east-2';
const COGNITO_API = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

function secretHash(username: string): string {
  return createHmac('sha256', CLIENT_SECRET).update(username + CLIENT_ID).digest('base64');
}

async function cognitoApi(target: string, body: object): Promise<any> {
  const res = await fetch(COGNITO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AmazonCognitoIdentityProvider.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (!res.ok) {
    const err = new Error(data.message || data.__type || 'Cognito error') as any;
    err.code = data.__type;
    throw err;
  }
  return data;
}

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

// POST /api/auth/login — direct sign-in with email + password
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    const data = await cognitoApi('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash(email),
      },
    });
    const { AccessToken: access_token, IdToken: id_token, ExpiresIn: expires_in } = data.AuthenticationResult;
    return res.json({ idToken: id_token, accessToken: access_token, expiresIn: expires_in });
  } catch (e: any) {
    return res.status(401).json({ error: e.message, code: e.code });
  }
});

// POST /api/auth/signup — create a new account
router.post('/signup', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    await cognitoApi('SignUp', {
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      SecretHash: secretHash(email),
      UserAttributes: [{ Name: 'email', Value: email }],
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message, code: e.code });
  }
});

// POST /api/auth/confirm — verify email with confirmation code
router.post('/confirm', async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };
  if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });
  try {
    await cognitoApi('ConfirmSignUp', {
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      SecretHash: secretHash(email),
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message, code: e.code });
  }
});

// POST /api/auth/resend — resend verification code
router.post('/resend', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Missing email' });
  try {
    await cognitoApi('ResendConfirmationCode', {
      ClientId: CLIENT_ID,
      Username: email,
      SecretHash: secretHash(email),
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message, code: e.code });
  }
});

export { router as authRouter };
