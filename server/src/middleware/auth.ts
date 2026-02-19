import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    authenticated: boolean
    profileId?: string
    iat: number
    exp: number
  }
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Skip auth if not enabled (for development without password set)
  if (!config.auth.enabled) {
    return next()
  }

  const authHeader = req.headers.authorization
  const queryToken = req.query.token as string | undefined

  // Try to get token from Authorization header or query parameter
  // Query parameter is needed for HLS.js requests that can't set headers
  let token: string | null = null

  if (authHeader) {
    token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader
  } else if (queryToken) {
    token = queryToken
  }

  if (!token) {
    return res.status(401).json({ error: 'No authorization header provided' })
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as {
      authenticated: boolean
      profileId?: string
      iat: number
      exp: number
    }

    req.user = decoded
    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' })
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    return res.status(401).json({ error: 'Authentication failed' })
  }
}
