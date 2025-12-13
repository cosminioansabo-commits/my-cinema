# Authentication Implementation Plan

## Overview
- **Type:** Single password authentication
- **Token:** JWT with 7-day expiry
- **Security:** Rate limiting, failed login logging

---

## Phase 1: Backend Authentication

### 1.1 Install Dependencies
```bash
cd server
npm install jsonwebtoken bcryptjs express-rate-limit
npm install -D @types/jsonwebtoken @types/bcryptjs
```

### 1.2 New Files

#### `server/src/middleware/auth.ts`
```typescript
- JWT verification middleware
- Extract token from Authorization header
- Verify and decode token
- Attach user info to request
- Return 401 if invalid/missing
```

#### `server/src/routes/auth.ts`
```typescript
- POST /api/auth/login
  - Validate password against hashed env var
  - Generate JWT token
  - Log failed attempts with IP and timestamp
  - Return { token, expiresAt }

- POST /api/auth/verify
  - Verify if current token is still valid
  - Return { valid: true/false }

- POST /api/auth/logout
  - Optional: Add token to blacklist (for immediate invalidation)
```

#### `server/src/utils/logger.ts`
```typescript
- Log failed login attempts to file
- Format: [timestamp] [IP] [reason]
- File: /logs/auth.log
```

### 1.3 Modify Files

#### `server/src/config.ts`
Add:
```typescript
auth: {
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  passwordHash: process.env.APP_PASSWORD_HASH || '',
  tokenExpiry: process.env.TOKEN_EXPIRY || '7d',
}
```

#### `server/src/index.ts`
```typescript
- Import auth routes
- Mount at /api/auth (unprotected)
- Apply auth middleware to:
  - /api/torrents/*
  - /api/library/*
- Rate limit /api/auth/login (5 attempts per minute per IP)
```

#### `server/src/websocket/progressSocket.ts`
```typescript
- Accept token as query parameter: ws://host/ws?token=xxx
- Verify token on connection
- Reject if invalid
```

### 1.4 Environment Variables

Add to `server/.env`:
```env
JWT_SECRET=generate-random-32-char-string
APP_PASSWORD_HASH=$2b$10$... (bcrypt hash of your password)
TOKEN_EXPIRY=7d
```

---

## Phase 2: Frontend Authentication

### 2.1 New Files

#### `src/stores/authStore.ts`
```typescript
- State: { token, isAuthenticated, expiresAt }
- Actions:
  - login(password) -> call API, store token in localStorage
  - logout() -> clear token, redirect to login
  - checkAuth() -> verify token validity on app load
- Getters:
  - isAuthenticated
  - tokenExpiresIn
```

#### `src/views/LoginView.vue`
```vue
- Simple centered login form
- Password input field
- "Sign In" button
- Error message display
- Dark theme matching app style
- Loading state during login
```

#### `src/composables/useAuthInterceptor.ts`
```typescript
- Setup axios interceptors for all API instances
- Add Authorization header to requests
- Handle 401 responses (redirect to login)
```

### 2.2 Modify Files

#### `src/router/index.ts`
```typescript
- Add /login route (public)
- Add navigation guard:
  - If not authenticated and route !== /login -> redirect to /login
  - If authenticated and route === /login -> redirect to /
```

#### `src/services/torrentService.ts`
```typescript
- Import and use auth interceptor
- Add request interceptor to attach token
- Add response interceptor for 401 handling
```

#### `src/services/libraryService.ts`
```typescript
- Same as torrentService.ts
```

#### `src/stores/torrentsStore.ts`
```typescript
- Modify WebSocket connection to include token
- ws://host/ws?token=${authStore.token}
```

#### `src/components/layout/AppHeader.vue`
```typescript
- Add logout button (icon: pi-sign-out)
- Show when authenticated
- Call authStore.logout() on click
```

#### `src/App.vue`
```typescript
- On mount, check auth status
- Initialize auth interceptors
```

---

## Phase 3: Docker & Deployment

### 3.1 Update docker-compose.nas.yml

Add to backend environment:
```yaml
services:
  my-cinema-backend:
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - APP_PASSWORD_HASH=${APP_PASSWORD_HASH}
      - TOKEN_EXPIRY=7d
```

### 3.2 Update .env.nas.example

Add:
```env
# Authentication
JWT_SECRET=your-random-32-character-secret-key
APP_PASSWORD_HASH=$2b$10$xxxxx  # Generate with: npx bcryptjs-cli hash "your-password"
```

### 3.3 Create password hash helper

Add npm script to server/package.json:
```json
"scripts": {
  "hash-password": "node -e \"const b=require('bcryptjs');console.log(b.hashSync(process.argv[1],10));\""
}
```

Usage: `npm run hash-password "my-secret-password"`

---

## File Structure

```
server/src/
├── middleware/
│   └── auth.ts              # NEW
├── routes/
│   ├── auth.ts              # NEW
│   ├── torrents.ts          # MODIFY
│   └── library.ts           # MODIFY
├── utils/
│   └── logger.ts            # NEW
├── websocket/
│   └── progressSocket.ts    # MODIFY
├── config.ts                # MODIFY
└── index.ts                 # MODIFY

src/
├── stores/
│   ├── authStore.ts         # NEW
│   └── torrentsStore.ts     # MODIFY
├── views/
│   ├── LoginView.vue        # NEW
│   └── ...
├── router/
│   └── index.ts             # MODIFY
├── services/
│   ├── torrentService.ts    # MODIFY
│   └── libraryService.ts    # MODIFY
├── composables/
│   └── useAuthInterceptor.ts # NEW
├── components/layout/
│   └── AppHeader.vue        # MODIFY
└── App.vue                  # MODIFY
```

---

## Implementation Order

1. [ ] Backend: Install dependencies
2. [ ] Backend: Add config variables
3. [ ] Backend: Create auth middleware
4. [ ] Backend: Create auth routes with rate limiting
5. [ ] Backend: Create login logger
6. [ ] Backend: Protect torrent routes
7. [ ] Backend: Protect library routes
8. [ ] Backend: Add WebSocket auth
9. [ ] Frontend: Create authStore
10. [ ] Frontend: Create LoginView
11. [ ] Frontend: Add router guard
12. [ ] Frontend: Setup axios interceptors
13. [ ] Frontend: Update WebSocket connection
14. [ ] Frontend: Add logout button
15. [ ] Docker: Update env variables
16. [ ] Test: Full flow locally
17. [ ] Deploy: Update NAS configuration

---

## Security Notes

1. **HTTPS Required** - Set up Nginx Proxy Manager with SSL before exposing to internet
2. **Password Strength** - Use a strong password (12+ chars, mixed case, numbers, symbols)
3. **JWT Secret** - Generate cryptographically random: `openssl rand -base64 32`
4. **Rate Limiting** - 5 login attempts per minute per IP
5. **Logging** - Failed attempts logged with IP for monitoring
6. **Token Storage** - localStorage (acceptable for personal app)

---

## Testing Checklist

- [ ] Login with correct password -> success, redirected to home
- [ ] Login with wrong password -> error message, stays on login
- [ ] Access protected route without token -> redirected to login
- [ ] Access protected route with valid token -> success
- [ ] Access protected route with expired token -> redirected to login
- [ ] Logout -> token cleared, redirected to login
- [ ] WebSocket connects with valid token
- [ ] WebSocket rejects invalid token
- [ ] Rate limiting triggers after 5 failed attempts
- [ ] Failed attempts are logged
