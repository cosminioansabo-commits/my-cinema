# my-cinema

A self-hosted media management application with Vue 3, integrating with Radarr, Sonarr, Prowlarr, and qBittorrent.

## Features

- Browse and search movies/TV shows via TMDB
- Search torrents via Prowlarr
- Download management with qBittorrent
- Integration with Radarr (movies) and Sonarr (TV shows)
- Optional password authentication for secure remote access

---

## Authentication Setup

My Cinema includes optional password protection to secure your instance when exposed to the internet. When enabled, users must enter a password to access the application.

### How It Works

- **Single password** - One shared password for all users
- **JWT tokens** - 7-day session duration (configurable)
- **Rate limiting** - 5 login attempts per minute per IP
- **Failed login logging** - All failed attempts logged with IP and timestamp
- **WebSocket protection** - Download progress updates are also protected

### Configuration

Authentication requires two environment variables:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Random secret key for signing tokens (32+ characters) |
| `APP_PASSWORD_HASH` | Bcrypt hash of your password |

### Step-by-Step Setup

#### 1. Generate a JWT Secret

```bash
openssl rand -base64 32
```

Example output: `K7xB2mN9pQ4rS8vY1zA3cF6gH0jL5oT=`

#### 2. Generate a Password Hash

**Option A: Using the included script**
```bash
cd server
npm install
npm run hash-password "your-secure-password"
```

**Option B: Using Node.js directly**
```bash
node -e "console.log(require('bcryptjs').hashSync('your-secure-password', 10))"
```

**Option C: Online generator**
Visit https://bcrypt-generator.com/ (use 10 rounds)

Example output: `$2b$10$N9qo8uLOickgx2ZMRZoMy.MqrqZlPf0LnZaFXZ6Y8a5hIvKK3H2Oe`

#### 3. Add to Environment File

For Docker deployment, add to your `.env` file:

```env
# Authentication
JWT_SECRET=K7xB2mN9pQ4rS8vY1zA3cF6gH0jL5oT=
APP_PASSWORD_HASH=$2b$10$N9qo8uLOickgx2ZMRZoMy.MqrqZlPf0LnZaFXZ6Y8a5hIvKK3H2Oe
TOKEN_EXPIRY=7d
```

For local development, add to `server/.env`:

```env
JWT_SECRET=dev-secret-change-in-production
APP_PASSWORD_HASH=$2b$10$your-hash-here
```

### Disabling Authentication

To run without authentication (for local/trusted networks):

- Simply **do not set** `APP_PASSWORD_HASH` in your environment
- The app will automatically allow all access without login

### Security Recommendations

1. **Use HTTPS** - When exposing to the internet, always use HTTPS (via reverse proxy like nginx or Traefik)
2. **Strong password** - Use a password with at least 12 characters
3. **Unique JWT secret** - Generate a new random secret for each deployment
4. **Monitor logs** - Check `logs/auth.log` for suspicious login attempts

### Changing Your Password

1. Generate a new hash:
   ```bash
   npm run hash-password "new-password"
   ```

2. Update `APP_PASSWORD_HASH` in your `.env` file

3. Restart the backend:
   ```bash
   docker compose restart my-cinema-backend
   ```

4. All existing sessions will remain valid until they expire (7 days by default)

### Token Expiry Options

Configure `TOKEN_EXPIRY` with these formats:
- `7d` - 7 days (default)
- `24h` - 24 hours
- `30d` - 30 days
- `1h` - 1 hour

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

### Environment Variables

Copy `.env.nas.example` to `.env` and configure your API keys and settings.

---

## Docker Deployment

See `docker-compose.my-cinema.yml` for the complete deployment configuration.

```bash
docker compose -f docker-compose.my-cinema.yml up -d
```
