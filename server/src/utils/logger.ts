/**
 * Simple logger utility.
 * - Startup/shutdown messages always print.
 * - Service debug messages only print when LOG_LEVEL=debug.
 * - Errors/warnings always print.
 */

const isDebug = process.env.LOG_LEVEL === 'debug'

function formatPrefix(service?: string): string {
  return service ? `[${service}]` : ''
}

export const logger = {
  /** Always shown — server startup, shutdown, critical lifecycle events */
  info(message: string, service?: string) {
    console.log(`${formatPrefix(service)} ${message}`.trimStart())
  },

  /** Only shown when LOG_LEVEL=debug — verbose service-level tracing */
  debug(message: string, service?: string) {
    if (isDebug) {
      console.log(`${formatPrefix(service)} ${message}`.trimStart())
    }
  },

  /** Always shown */
  warn(message: string, service?: string) {
    console.warn(`${formatPrefix(service)} ${message}`.trimStart())
  },

  /** Always shown */
  error(message: string, error?: unknown, service?: string) {
    console.error(`${formatPrefix(service)} ${message}`.trimStart(), error ?? '')
  },
}
