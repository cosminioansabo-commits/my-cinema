import fs from 'fs'
import path from 'path'
import { Request } from 'express'

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs')
const AUTH_LOG_FILE = path.join(LOG_DIR, 'auth.log')

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

export type AuthLogEvent = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN'

export interface AuthLogEntry {
  timestamp: string
  event: AuthLogEvent
  ip: string
  userAgent?: string
  reason?: string
}

export const logAuthEvent = (entry: Omit<AuthLogEntry, 'timestamp'>) => {
  const logEntry: AuthLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  }

  const logLine = `[${logEntry.timestamp}] ${logEntry.event} | IP: ${logEntry.ip} | UA: ${logEntry.userAgent || 'unknown'} | ${logEntry.reason || ''}\n`

  // Append to log file
  fs.appendFile(AUTH_LOG_FILE, logLine, (err) => {
    if (err) {
      console.error('Failed to write auth log:', err)
    }
  })

  // Also log to console for visibility
  if (logEntry.event === 'LOGIN_FAILED') {
    console.warn(`[AUTH] Failed login attempt from ${logEntry.ip}: ${logEntry.reason}`)
  } else if (logEntry.event === 'LOGIN_SUCCESS') {
    console.log(`[AUTH] Successful login from ${logEntry.ip}`)
  }
}

export const getClientIp = (req: Request): string => {
  // Check for forwarded IP (behind proxy)
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
    return ip.trim()
  }

  const realIp = req.headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp
  }

  return req.ip || 'unknown'
}
