# My Cinema - NAS Deployment Guide

## Architecture

```
GitHub Push → GitHub Actions → Build Docker Images → GitHub Container Registry
                                                              ↓
                                    NAS (Watchtower) ← Pulls new images automatically
```

## Prerequisites

- GitHub account with repository
- UGREEN NAS with Docker support
- Dynamic DNS configured (e.g., subdomain.go.ro)

## Step 1: GitHub Setup

### 1.1 Create GitHub Repository

If not already done:
```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/my-cinema.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 1.2 Add GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:
| Secret Name | Value |
|-------------|-------|
| `VITE_TMDB_API_KEY` | Your TMDB API key |
| `VITE_TORRENT_API_URL` | `http://subdomain.go.ro:3001` |

### 1.3 Enable GitHub Packages

Go to your repository → Settings → Actions → General:
- Workflow permissions: "Read and write permissions"
- Allow GitHub Actions to create and approve pull requests: ✅

## Step 2: NAS Setup

### 2.1 Create Folder Structure

SSH into your NAS or use File Station:
```bash
# Create data folders on HDD (volume1)
mkdir -p /volume1/data/downloads
mkdir -p /volume1/data/movies
mkdir -p /volume1/data/tv

# Create Docker config folders on SSD (volume2)
mkdir -p /volume2/docker/qbittorrent
mkdir -p /volume2/docker/radarr
mkdir -p /volume2/docker/sonarr
mkdir -p /volume2/docker/prowlarr
mkdir -p /volume2/docker/my-cinema
```

### 2.2 Find Your User ID

```bash
id your-username
# Example output: uid=1000(admin) gid=1000(users)
# Use PUID=1000 and PGID=1000
```

### 2.3 Copy Files to NAS

Copy these files to `/volume2/docker/my-cinema/`:
- `docker-compose.nas.yml` (rename to `docker-compose.yml`)
- `.env.nas.example` (rename to `.env` and fill in values)

### 2.4 Configure .env

Edit `/volume2/docker/my-cinema/.env`:
```env
GITHUB_USERNAME=your-github-username
NAS_IP=subdomain.go.ro
PUID=1000
PGID=1000
TZ=Europe/Bucharest
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=your-secure-password
PROWLARR_API_KEY=   # Fill after first setup
RADARR_API_KEY=     # Fill after first setup
SONARR_API_KEY=     # Fill after first setup
```

### 2.5 Login to GitHub Container Registry

On your NAS, authenticate Docker to pull private images:
```bash
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Create a Personal Access Token at: https://github.com/settings/tokens
- Select scopes: `read:packages`

## Step 3: First Deployment

### 3.1 Push Code to GitHub

```bash
git add .
git commit -m "Add Docker deployment"
git push
```

### 3.2 Wait for GitHub Actions

Go to your repository → Actions tab and wait for the build to complete (first build takes ~5 min).

### 3.3 Start Services on NAS

```bash
cd /volume2/docker/my-cinema
docker-compose up -d
```

### 3.4 Get API Keys

After services start, get API keys from each service:

1. **Prowlarr**: http://NAS_IP:9696 → Settings → General → API Key
2. **Radarr**: http://NAS_IP:7878 → Settings → General → API Key
3. **Sonarr**: http://NAS_IP:8989 → Settings → General → API Key

Update `.env` with these keys and restart:
```bash
docker-compose down
docker-compose up -d
```

## Step 4: Configure Services

### 4.1 qBittorrent

Access: http://NAS_IP:8080 (default: admin/adminadmin)

1. Change password immediately
2. Settings → Downloads:
   - Default Save Path: `/data/downloads`
3. Add categories:
   - `radarr` → Save path: `/data/downloads/movies`
   - `sonarr` → Save path: `/data/downloads/tv`

### 4.2 Prowlarr

Access: http://NAS_IP:9696

1. Add indexers (Settings → Indexers)
2. Add download client:
   - Settings → Download Clients → + → qBittorrent
   - Host: `qbittorrent`
   - Port: `8080`
3. Add apps:
   - Settings → Apps → + → Radarr (host: `radarr`, port: `7878`)
   - Settings → Apps → + → Sonarr (host: `sonarr`, port: `8989`)

### 4.3 Radarr

Access: http://NAS_IP:7878

1. Settings → Media Management:
   - Root Folder: `/data/movies`
2. Settings → Download Clients → + → qBittorrent:
   - Host: `qbittorrent`
   - Port: `8080`
   - Category: `radarr`

### 4.4 Sonarr

Access: http://NAS_IP:8989

1. Settings → Media Management:
   - Root Folder: `/data/tv`
2. Settings → Download Clients → + → qBittorrent:
   - Host: `qbittorrent`
   - Port: `8080`
   - Category: `sonarr`

## Step 5: Access Your App

- **Frontend**: http://subdomain.go.ro (port 80)
- **Backend API**: http://subdomain.go.ro:3001

## Auto-Updates

Watchtower checks for new images every 5 minutes. When you push to GitHub:

1. GitHub Actions builds new images
2. Pushes to GitHub Container Registry
3. Watchtower detects new images
4. Automatically pulls and restarts containers

## Port Summary

| Service | Port | URL |
|---------|------|-----|
| Frontend | 80 | http://subdomain.go.ro |
| Backend | 3001 | http://subdomain.go.ro:3001 |
| qBittorrent | 8080 | http://subdomain.go.ro:8080 |
| Radarr | 7878 | http://subdomain.go.ro:7878 |
| Sonarr | 8989 | http://subdomain.go.ro:8989 |
| Prowlarr | 9696 | http://subdomain.go.ro:9696 |

## Troubleshooting

### Check container logs
```bash
docker logs my-cinema-frontend
docker logs my-cinema-backend
docker logs watchtower
```

### Restart all services
```bash
docker-compose down && docker-compose up -d
```

### Force pull latest images
```bash
docker-compose pull
docker-compose up -d
```

### Check Watchtower status
```bash
docker logs watchtower --tail 50
```
