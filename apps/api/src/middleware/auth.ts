/**
 * AWS Cognito authentication middleware.
 *
 * Validates JWT tokens from AWS Cognito User Pool and extracts user identity.
 */
import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

const COGNITO_REGION = process.env.AWS_REGION || 'us-east-1';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

const jwksUri = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
const issuer = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

export const cognitoAuth = expressjwt({
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

export const requireAuth = [cognitoAuth, extractUserId];

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    cognitoAuth(req, res, (err: any) => {
        if (err) return next();
        extractUserId(req, res, next);
    });
}
