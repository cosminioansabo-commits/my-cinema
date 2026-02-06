# My Cinema Infrastructure Documentation

## Hardware

**NAS:** UGREEN NAS
**Hostname:** NAS-cosmin
**IP Address:** 192.168.0.82
**Domain:** co-sa-srv.go.ro
**OS:** Debian GNU/Linux 12 (bookworm)
**Docker:** v26.1.0

### Storage

| Volume | Size | Used | Available | Mount |
|--------|------|------|-----------|-------|
| volume1 (Pool 1) | 3.7 TB | 1.7 TB (45%) | 2.0 TB | /volume1 |
| volume2 (Pool 2) | 917 GB | 22 GB (3%) | 893 GB | /volume2 |

### Memory

| Type | Total | Used | Available |
|------|-------|------|-----------|
| RAM | 7.5 GB | 5.0 GB | 2.5 GB |
| Swap | 5.8 GB | 3.2 GB | 2.6 GB |

---

## Docker Network

All media services are connected via `my-cinema-network` (bridge mode), allowing container-to-container communication using container names as hostnames.

**Containers on my-cinema-network:**
- my-cinema-frontend
- my-cinema-backend
- jellyfin
- radarr
- sonarr
- prowlarr
- qbittorrent
- watchtower

---

## Docker Containers

### My Cinema App

| Container | Image | Port | Status |
|-----------|-------|------|--------|
| my-cinema-frontend | ghcr.io/cosminioansabo-commits/my-cinema-frontend:latest | 8081:80 | Running |
| my-cinema-backend | ghcr.io/cosminioansabo-commits/my-cinema-backend:latest | 3001:3001 | Running (healthy) |

**Frontend Volumes:**
- None (static files served from container)

**Backend Volumes:**
- `/volume1/data` → `/data` (media library + SQLite database)
- `/tmp/hls-sessions` → `/tmp/hls-sessions` (HLS transcoding temp files)

**Backend Environment:**
```
PORT=3001
CORS_ORIGIN=http://co-sa-srv.go.ro:8081
BACKEND_EXTERNAL_URL=http://co-sa-srv.go.ro:3001

# Jellyfin
JELLYFIN_URL=http://jellyfin:8096
JELLYFIN_EXTERNAL_URL=http://co-sa-srv.go.ro:8096

# *arr Stack
RADARR_URL=http://radarr:7878
SONARR_URL=http://sonarr:8989
PROWLARR_URL=http://prowlarr:9696

# qBittorrent
QBITTORRENT_URL=http://qbittorrent:8080
QBITTORRENT_USERNAME=admin

# Paths
DOWNLOAD_PATH=/data/downloads
SEARCH_PROVIDERS=prowlarr

# Auth
TOKEN_EXPIRY=7d

# Subtitles
OPENSUBTITLES_USERNAME=coconute
```

---

### Media Server

| Container | Image | Port | Status |
|-----------|-------|------|--------|
| jellyfin | jellyfin/jellyfin:latest | 8096:8096 | Running (healthy) |
| plex | linuxserver/plex:latest | (host network) | Running |

**Jellyfin Volumes:**
- `/volume2/docker/jellyfin/config` → `/config`
- `/volume2/docker/jellyfin/cache` → `/cache`
- `/volume1/data` → `/data`

**Plex Volumes:**
- (similar config structure in `/volume2/docker/plex`)

---

### Download Stack

| Container | Image | Port | Status |
|-----------|-------|------|--------|
| qbittorrent | linuxserver/qbittorrent:latest | 8080:8080, 6881:6881 | Running |
| prowlarr | linuxserver/prowlarr:latest | 9696:9696 | Running |
| radarr | linuxserver/radarr:latest | 7878:7878 | Running |
| sonarr | linuxserver/sonarr:latest | 8989:8989 | Running |

**qBittorrent Volumes:**
- `/volume2/docker/qbittorrent` → `/config`
- `/volume1/data` → `/data`

**Prowlarr Volumes:**
- `/volume2/docker/prowlarr` → `/config`

**Radarr Volumes:**
- `/volume2/docker/radarr` → `/config`
- `/volume1/data` → `/data`

**Sonarr Volumes:**
- `/volume2/docker/sonarr` → `/config`
- `/volume1/data` → `/data`

---

### Utility Services

| Container | Image | Port | Status |
|-----------|-------|------|--------|
| watchtower | containrrr/watchtower | - | Running (healthy) |
| homeassistant-app-1 | ugreen/home-assistant:v1 | (host network) | Running |
| firefox-app-1 | ugreen/firefox:v2 | 5888:5800, 5999:5900 | Running |
| tailscale | tailscale/tailscale:latest | - | Stopped |

**Watchtower:** Auto-updates Docker containers

---

## Directory Structure

### /volume1/data (Media Library)
```
/volume1/data/
├── downloads/          # qBittorrent download location
├── movies/             # Radarr movie library
├── tv/                 # Sonarr TV library
├── my-cinema.db        # SQLite database (watch progress)
├── my-cinema.db-shm    # SQLite shared memory
└── my-cinema.db-wal    # SQLite write-ahead log
```

### /volume2/docker (Container Configs)
```
/volume2/docker/
├── home_asistant/      # Home Assistant config
├── jellyfin/           # Jellyfin config + cache
├── my-cinema/          # My Cinema related configs
├── plex/               # Plex config
├── prowlarr/           # Prowlarr config
├── qbittorrent/        # qBittorrent config
├── radarr/             # Radarr config
├── sonarr/             # Sonarr config
├── tailscale/          # Tailscale config
└── watchtower/         # Watchtower config
```

---

## Service URLs

### Internal (Container-to-Container)
| Service | URL |
|---------|-----|
| Jellyfin | http://jellyfin:8096 |
| Radarr | http://radarr:7878 |
| Sonarr | http://sonarr:8989 |
| Prowlarr | http://prowlarr:9696 |
| qBittorrent | http://qbittorrent:8080 |

### External (Browser Access)
| Service | URL |
|---------|-----|
| My Cinema | http://co-sa-srv.go.ro:8081 |
| My Cinema API | http://co-sa-srv.go.ro:3001 |
| Jellyfin | http://co-sa-srv.go.ro:8096 |
| Radarr | http://192.168.0.82:7878 |
| Sonarr | http://192.168.0.82:8989 |
| Prowlarr | http://192.168.0.82:9696 |
| qBittorrent | http://192.168.0.82:8080 |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         My Cinema App                            │
│  ┌──────────────┐        ┌──────────────┐                       │
│  │   Frontend   │◄──────►│   Backend    │                       │
│  │   :8081      │        │   :3001      │                       │
│  └──────────────┘        └──────┬───────┘                       │
│                                 │                                │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
   │  Jellyfin   │        │   Radarr    │        │   Sonarr    │
   │   :8096     │        │   :7878     │        │   :8989     │
   │  (Playback) │        │  (Movies)   │        │   (TV)      │
   └─────────────┘        └──────┬──────┘        └──────┬──────┘
          │                      │                      │
          │               ┌──────┴──────┐               │
          │               │             │               │
          │               ▼             ▼               │
          │        ┌─────────────┐ ┌─────────────┐      │
          │        │  Prowlarr   │ │qBittorrent  │      │
          │        │   :9696     │ │   :8080     │      │
          │        │ (Indexers)  │ │ (Downloads) │      │
          │        └─────────────┘ └─────────────┘      │
          │                             │               │
          └─────────────────────────────┼───────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │  /volume1/data  │
                              │  ┌───────────┐  │
                              │  │ downloads │  │
                              │  │  movies   │  │
                              │  │    tv     │  │
                              │  └───────────┘  │
                              └─────────────────┘
```

---

## Deployment

### GitHub Actions CI/CD

The app is automatically built and pushed to GitHub Container Registry on push to `main`:

1. GitHub Actions builds Docker images
2. Images pushed to `ghcr.io/cosminioansabo-commits/my-cinema-frontend` and `ghcr.io/cosminioansabo-commits/my-cinema-backend`
3. Watchtower on NAS detects new images and auto-updates containers

### Manual Deployment

```bash
# SSH to NAS
ssh Cosmin@192.168.0.82

# Pull latest images
sudo docker pull ghcr.io/cosminioansabo-commits/my-cinema-frontend:latest
sudo docker pull ghcr.io/cosminioansabo-commits/my-cinema-backend:latest

# Restart containers
sudo docker restart my-cinema-frontend my-cinema-backend
```

---

## Maintenance

### Logs

```bash
# View container logs
sudo docker logs my-cinema-backend -f
sudo docker logs my-cinema-frontend -f
sudo docker logs jellyfin -f

# View all container stats
sudo docker stats
```

### Backup

Important directories to backup:
- `/volume1/data/my-cinema.db*` - Watch progress database
- `/volume2/docker/*/` - All container configurations

### Database

The SQLite database is located at `/volume1/data/my-cinema.db` and stores:
- Watch progress for movies and TV episodes
- Position timestamps for resume functionality

---

## Security Notes

- All services run on internal network, exposed via `co-sa-srv.go.ro` dynamic DNS
- Authentication enabled on My Cinema app (JWT-based)
- API keys stored as environment variables (not in config files)
- Tailscale available but currently stopped (for remote access)
