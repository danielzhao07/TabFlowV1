/**
 * TabFlow AWS test script
 * Uses AdminInitiateAuth (AWS IAM credentials) with SECRET_HASH support.
 * Run from apps/api/: node test-aws.mjs
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHmac } from 'crypto';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.AWS_REGION;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;
const API = 'http://localhost:3001';
const TEST_EMAIL = 'testuser@tabflow.dev';
const TEST_PASSWORD = 'TestPass123!';

// Tiny 1x1 pixel WebP image (base64) for S3 upload test
const TINY_WEBP_B64 =
  'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAUAmJYgCdAEO/gHOAAD++P/Z' +
  'A3gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function secretHash(username) {
  if (!CLIENT_SECRET) return undefined;
  return createHmac('sha256', CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest('base64');
}

const cognito = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function run() {
  console.log('=== TabFlow AWS Test ===');
  console.log(`Region: ${REGION} | Pool: ${USER_POOL_ID}`);
  console.log(`Client secret: ${CLIENT_SECRET ? 'configured ✅' : 'not set (public client)'}\n`);

  // 1. Create + confirm test user
  console.log('1. Creating test Cognito user...');
  try {
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: TEST_EMAIL,
      MessageAction: 'SUPPRESS',
      TemporaryPassword: TEST_PASSWORD,
    }));
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: TEST_EMAIL,
      Password: TEST_PASSWORD,
      Permanent: true,
    }));
    console.log('   ✅ User created\n');
  } catch (e) {
    if (e.name === 'UsernameExistsException') {
      console.log('   ℹ️  User already exists\n');
    } else {
      console.error('   ❌', e.name + ':', e.message, '\n');
      process.exit(1);
    }
  }

  // 2. Get JWT using AdminInitiateAuth (uses IAM creds)
  console.log('2. Getting JWT token via AdminInitiateAuth...');
  let token;
  try {
    const authParams = { USERNAME: TEST_EMAIL, PASSWORD: TEST_PASSWORD };
    const hash = secretHash(TEST_EMAIL);
    if (hash) authParams.SECRET_HASH = hash;

    const auth = await cognito.send(new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: authParams,
    }));
    token = auth.AuthenticationResult?.IdToken;
    console.log('   ✅ Got token:', token?.slice(0, 50) + '...\n');
  } catch (e) {
    console.error('   ❌', e.name + ':', e.message);
    if (e.name === 'NotAuthorizedException' && e.message.includes('SECRET_HASH')) {
      console.error('\n   👉 Fix: Add COGNITO_CLIENT_SECRET to apps/api/.env');
      console.error('   Find it: AWS Console → Cognito → User pool → App integration');
      console.error('   → App clients → tabflow-extension → Client secret\n');
    }
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 3. Health check
  console.log('3. Health check...');
  const health = await fetch(`${API}/health`).then(r => r.json()).catch(e => ({ error: e.message }));
  console.log('   ' + (health.status === 'ok' ? '✅' : '❌'), JSON.stringify(health), '\n');

  // 4. S3 thumbnail upload (POST /api/thumbnails/upload with tiny test image)
  console.log('4. S3 thumbnail upload...');
  try {
    const res = await fetch(`${API}/api/thumbnails/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tabUrl: 'https://google.com',
        imageData: TINY_WEBP_B64,
        contentType: 'image/webp',
      }),
    });
    const data = await res.json();
    if (res.ok && data.key) {
      console.log('   ✅ Uploaded to S3:', data.key, '\n');
    } else {
      console.log('   ❌', JSON.stringify(data), '\n');
    }
  } catch (e) {
    console.log('   ❌', e.message, '\n');
  }

  // 5. Neon DB — workspaces
  console.log('5. Neon DB (workspaces)...');
  try {
    const res = await fetch(`${API}/api/sync/workspaces`, { headers });
    const data = await res.json();
    console.log('   ' + (res.ok ? '✅' : '❌'), JSON.stringify(data).slice(0, 80), '\n');
  } catch (e) {
    console.log('   ❌', e.message, '\n');
  }

  // 6. Gemini AI — embed then search
  console.log('6. Gemini AI semantic search...');
  try {
    // First embed a test tab so search has something to find
    const embedRes = await fetch(`${API}/api/ai/embed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: 'https://react.dev',
        title: 'React – The library for web and native user interfaces',
        contentSummary: 'React TypeScript frontend framework',
      }),
    });
    const embedData = await embedRes.json();
    if (!embedRes.ok) {
      console.log('   ❌ Embed failed:', JSON.stringify(embedData), '\n');
    } else {
      console.log('   ✅ Embedded tab:', embedData.url);
      // Now search
      const searchRes = await fetch(`${API}/api/ai/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: 'react typescript', limit: 2 }),
      });
      const searchData = await searchRes.json();
      if (searchRes.ok) {
        console.log('   ✅ Search returned', searchData.results?.length ?? 0, 'results\n');
      } else {
        console.log('   ❌ Search failed:', JSON.stringify(searchData), '\n');
      }
    }
  } catch (e) {
    console.log('   ❌', e.message, '\n');
  }

  console.log('=== Done ===');
}

run().catch(console.error);
