import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config, googleAudiences } from '../config.js';
import { resolveGoogleIdentity } from '../services/googleAuth.js';
import { User } from '../models/User.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  formatUserProfile,
} from '../utils/auth.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRouter = Router();

// Brute-force protection for credential endpoints (disabled under test)
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(20).optional(),
  // googleId + email are only honoured in explicit dev-mock mode (see resolveGoogleIdentity)
  googleId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  avatarId: z.string().optional(),
});

const profileUpdateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  avatarId: z.string().optional(),
  dob: z.string().optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1, 'Contact name is required'),
      phone: z.string().min(7, 'Valid contact phone number is required'),
    })
    .optional(),
  fcmToken: z.string().optional(),
});

// Check username availability (live check, case-insensitive)
authRouter.get('/check-username', async (req, res, next) => {
  try {
    const rawUsername = req.query.username;
    if (!rawUsername || typeof rawUsername !== 'string') {
      throw new AppError('Query parameter "username" is required', 400);
    }

    const clean = rawUsername.trim().toLowerCase();
    if (clean.length < 3 || clean.length > 20 || !/^[a-z0-9_]+$/.test(clean)) {
      return res.status(200).json({
        available: false,
        username: clean,
        reason: 'Invalid format. Use 3-20 characters: letters, numbers, and underscores.',
      });
    }

    const existing = await User.findOne({ username: clean });
    return res.status(200).json({
      available: !existing,
      username: clean,
    });
  } catch (err) {
    next(err);
  }
});

// Email/Password Registration
authRouter.post('/register', credentialLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const lowercaseEmail = data.email.toLowerCase().trim();
    const lowercaseUsername = data.username.toLowerCase().trim();

    // Check if email already registered
    const existingEmail = await User.findOne({ email: lowercaseEmail });
    if (existingEmail) {
      throw new AppError('Email address is already registered', 409);
    }

    // Check if username is taken
    const existingUsername = await User.findOne({ username: lowercaseUsername });
    if (existingUsername) {
      throw new AppError('Username is already taken', 409);
    }

    const passwordHash = hashPassword(data.password);

    const newUser = await User.create({
      email: lowercaseEmail,
      username: lowercaseUsername,
      passwordHash,
      stats: {
        games: 0,
        wins: 0,
        tags: 0,
        escapes: 0,
        kmRun: 0,
      },
    });

    const token = generateToken(newUser);
    return res.status(201).json({
      token,
      user: formatUserProfile(newUser),
    });
  } catch (err) {
    next(err);
  }
});

// Email/Password Login
authRouter.post('/login', credentialLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const lowercaseEmail = data.email.toLowerCase().trim();

    const user = await User.findOne({ email: lowercaseEmail }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password credentials', 401);
    }

    const isMatch = verifyPassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password credentials', 401);
    }

    const token = generateToken(user);
    return res.status(200).json({
      token,
      user: formatUserProfile(user),
    });
  } catch (err) {
    next(err);
  }
});

// Google Sign-In
authRouter.post('/google', credentialLimiter, async (req, res, next) => {
  try {
    const data = googleAuthSchema.parse(req.body);
    const identity = await resolveGoogleIdentity(data, {
      audiences: googleAudiences(),
      allowDevMock: config.ALLOW_DEV_GOOGLE_MOCK,
      nodeEnv: config.NODE_ENV,
    });
    const lowercaseEmail = identity.email;

    let user = await User.findOne({
      $or: [{ googleId: identity.googleId }, { email: lowercaseEmail }],
    });

    // Never re-link an account that is already bound to a different Google identity
    if (user?.googleId && user.googleId !== identity.googleId) {
      throw new AppError('This email is already linked to a different Google account', 409);
    }

    if (!user) {
      // Generate default unique username from email handle if not provided
      let baseUsername = (data.username || lowercaseEmail.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 15);
      if (baseUsername.length < 3) baseUsername = `runner_${Math.floor(1000 + Math.random() * 9000)}`;

      let candidateUsername = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: candidateUsername })) {
        candidateUsername = `${baseUsername}${counter++}`;
      }

      user = await User.create({
        googleId: identity.googleId,
        email: lowercaseEmail,
        username: candidateUsername,
        avatarId: data.avatarId || 'wolf',
        stats: {
          games: 0,
          wins: 0,
          tags: 0,
          escapes: 0,
          kmRun: 0,
        },
      });
    } else if (!user.googleId) {
      user.googleId = identity.googleId;
      await user.save();
    }

    const token = generateToken(user);
    return res.status(200).json({
      token,
      user: formatUserProfile(user),
    });
  } catch (err) {
    next(err);
  }
});

// Get current authenticated user profile
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    return res.status(200).json({
      user: formatUserProfile(user),
    });
  } catch (err) {
    next(err);
  }
});

// Update profile
authRouter.patch(
  '/profile',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const data = profileUpdateSchema.parse(req.body);
      const user = await User.findById(req.user!.userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (data.username) {
        const cleanUsername = data.username.toLowerCase().trim();
        if (cleanUsername !== user.username) {
          const taken = await User.findOne({ username: cleanUsername });
          if (taken) {
            throw new AppError('Username is already taken', 409);
          }
          user.username = cleanUsername;
        }
      }

      if (data.avatarId !== undefined) user.avatarId = data.avatarId;
      if (data.dob !== undefined) user.dob = data.dob;
      if (data.emergencyContact !== undefined) user.emergencyContact = data.emergencyContact;
      if (data.fcmToken !== undefined) user.fcmToken = data.fcmToken;

      await user.save();

      return res.status(200).json({
        user: formatUserProfile(user),
      });
    } catch (err) {
      next(err);
    }
  }
);
