/**
 * Authentication middleware.
 *
 * When Cognito is enabled:
 *   1. If Bearer token present → validate JWT, use Cognito sub as user_id
 *   2. If JWT fails or absent → fall back to x-device-id header
 *   3. If neither → 401
 *
 * When Cognito is disabled:
 *   - x-device-id header used directly as user identity
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
        return res.status(401).json({ error: 'Missing authentication. Provide a Bearer token or x-device-id header.' });
    }
    req.headers['x-user-id'] = deviceId;
    next();
}

/** Flexible auth: try JWT first, fall back to device-id */
function flexibleAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        cognitoJwt(req, res, (err: any) => {
            if (!err) {
                return extractUserId(req, res, next);
            }
            // JWT failed — fall back to device-id
            const deviceId = req.headers['x-device-id'] as string;
            if (deviceId) {
                req.headers['x-user-id'] = deviceId;
                return next();
            }
            return res.status(401).json({ error: 'Invalid token and no x-device-id fallback' });
        });
    } else {
        deviceIdAuth(req, res, next);
    }
}

export const cognitoAuth = USE_COGNITO ? flexibleAuth : deviceIdAuth;
export const requireAuth: Array<(req: Request, res: Response, next: NextFunction) => void> = [
    USE_COGNITO ? flexibleAuth : deviceIdAuth,
];

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
    const deviceId = req.headers['x-device-id'] as string;
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ') && USE_COGNITO) {
        cognitoJwt(req, res, (err: any) => {
            if (!err) return extractUserId(req, res, next);
            if (deviceId) req.headers['x-user-id'] = deviceId;
            next();
        });
    } else {
        if (deviceId) req.headers['x-user-id'] = deviceId;
        next();
    }
}
