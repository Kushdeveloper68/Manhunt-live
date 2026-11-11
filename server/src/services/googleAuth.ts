import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../middleware/errorHandler.js';

export interface GoogleIdentity {
  googleId: string;
  email: string;
}

/** Verifies a Google ID token and returns the identity inside it. Injectable for tests. */
export type IdTokenVerifier = (idToken: string, audiences: string[]) => Promise<GoogleIdentity>;

const client = new OAuth2Client();

export const verifyGoogleIdToken: IdTokenVerifier = async (idToken, audiences) => {
  const ticket = await client.verifyIdToken({ idToken, audience: audiences });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new AppError('Google account email is not verified', 401);
  }
  return { googleId: payload.sub, email: payload.email.toLowerCase() };
};

export interface GoogleLoginInput {
  idToken?: string;
  googleId?: string;
  email?: string;
}

export interface GoogleAuthDeps {
  verifier?: IdTokenVerifier;
  audiences: string[];
  allowDevMock: boolean;
  nodeEnv: string;
}

/**
 * Turns a login request into a TRUSTED Google identity.
 * - Normal path: a Google ID token, cryptographically verified (signature, expiry, audience).
 * - Dev path: unverified googleId+email, only when explicitly enabled and never in production.
 * A client-supplied email/googleId is never trusted on its own otherwise.
 */
export async function resolveGoogleIdentity(
  input: GoogleLoginInput,
  deps: GoogleAuthDeps
): Promise<GoogleIdentity> {
  if (input.idToken) {
    if (deps.audiences.length === 0) {
      throw new AppError('Google sign-in is not configured on the server', 503);
    }
    const verify = deps.verifier ?? verifyGoogleIdToken;
    try {
      return await verify(input.idToken, deps.audiences);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Invalid Google token', 401);
    }
  }

  if (deps.allowDevMock && deps.nodeEnv !== 'production' && input.googleId && input.email) {
    return { googleId: input.googleId, email: input.email.toLowerCase().trim() };
  }

  throw new AppError('A Google ID token is required', 401);
}
