import { Router, Request, Response } from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { config } from '../config.js'
import { logAuthEvent, getClientIp } from '../utils/authLogger.js'

// Helper to create JWT with proper typing
const createToken = (payload: object): string => {
  // expiresIn accepts seconds (number) or string like "7d", "1h", etc.
  // Cast to any to bypass strict typing from newer @types/jsonwebtoken
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.tokenExpiry
  } as jwt.SignOptions)
}

const router = Router()

// Rate limiting for login endpoint - 5 attempts per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logAuthEvent({
      event: 'LOGIN_FAILED',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      reason: 'Rate limit exceeded'
    })
    res.status(429).json({ error: 'Too many login attempts, please try again after a minute' })
  }
})

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { password } = req.body
  const clientIp = getClientIp(req)
  const userAgent = req.headers['user-agent']

  // Check if auth is enabled
  if (!config.auth.enabled) {
    // If no password is configured, allow access (development mode)
    const token = createToken({ authenticated: true })
    const decoded = jwt.decode(token) as { exp: number }

    return res.json({
      token,
      expiresAt: decoded.exp * 1000 // Convert to milliseconds
    })
  }

  if (!password) {
    logAuthEvent({
      event: 'LOGIN_FAILED',
      ip: clientIp,
      userAgent,
      reason: 'No password provided'
    })
    return res.status(400).json({ error: 'Password is required' })
  }

  try {
    // Verify password against stored hash
    const isValid = await bcrypt.compare(password, config.auth.passwordHash)

    if (!isValid) {
      logAuthEvent({
        event: 'LOGIN_FAILED',
        ip: clientIp,
        userAgent,
        reason: 'Invalid password'
      })
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Generate JWT token
    const token = createToken({ authenticated: true })
    const decoded = jwt.decode(token) as { exp: number }

    logAuthEvent({
      event: 'LOGIN_SUCCESS',
      ip: clientIp,
      userAgent
    })

    res.json({
      token,
      expiresAt: decoded.exp * 1000 // Convert to milliseconds
    })
  } catch (error) {
    console.error('Login error:', error)
    logAuthEvent({
      event: 'LOGIN_FAILED',
      ip: clientIp,
      userAgent,
      reason: 'Server error'
    })
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/verify
router.post('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  if (!token) {
    return res.json({ valid: false })
  }

  try {
    jwt.verify(token, config.auth.jwtSecret)
    res.json({ valid: true })
  } catch {
    res.json({ valid: false })
  }
})

// GET /api/auth/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    authEnabled: config.auth.enabled
  })
})

export default router
