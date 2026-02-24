/**
 * Authentication middleware.
 *
 * Supports two modes:
 * 1. Cognito JWT (production) — when COGNITO_USER_POOL_ID is set
 * 2. Device-ID (dev/local) — x-device-id header used directly as user identity
 */
import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

const COGNITO_REGION = process.env.AWS_REGION || 'us-east-1';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';
export const USE_COGNITO = !!(COGNITO_USER_POOL_ID && COGNITO_CLIENT_ID);

const jwksUri = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
const issuer = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

const cognitoJwt = expressjwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
    }) as any,
    audience: COGNITO_CLIENT_ID,
    issuer,
    algorithms: ['RS256'],
});

export function extractUserId(req: Request, _res: Response, next: NextFunction) {
    const auth = (req as any).auth;
    if (auth?.sub) {
        req.headers['x-user-id'] = auth.sub;
    }
    next();
}

/** Device-ID mode: accept x-device-id header directly as user identity */
function deviceIdAuth(req: Request, res: Response, next: NextFunction) {
    const deviceId = req.headers['x-device-id'] as string;
    if (!deviceId) {
        return res.status(401).json({ error: 'Missing x-device-id header. Set x-device-id to your device UUID.' });
    }
    req.headers['x-user-id'] = deviceId;
    next();
}

export const cognitoAuth = USE_COGNITO ? cognitoJwt : deviceIdAuth;

export const requireAuth: Array<(req: Request, res: Response, next: NextFunction) => void> = USE_COGNITO
    ? [cognitoJwt as any, extractUserId]
    : [deviceIdAuth];

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
    if (!USE_COGNITO) {
        const deviceId = req.headers['x-device-id'] as string;
        if (deviceId) req.headers['x-user-id'] = deviceId;
        return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    cognitoJwt(req, res, (err: any) => {
        if (err) return next();
        extractUserId(req, res, next);
    });
}
