import rateLimit from 'express-rate-limit';

/**
 * Low-risk anti-abuse protections for public auth endpoints.
 * Kept intentionally permissive to avoid impacting legitimate users.
 */

const standard = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });

export const loginRateLimiter = standard({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many login attempts. Please try again later.',
});

export const registerRateLimiter = standard({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many registration attempts. Please try again later.',
});

export const profileRateLimiter = standard({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many requests. Please try again later.',
});

export const refreshRateLimiter = standard({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many refresh requests. Please try again later.',
});

export const logoutRateLimiter = standard({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many logout requests. Please try again later.',
});

