# Glyphforge NAS Deployment Guide

## Prerequisites

### NAS System Requirements
- Linux system (Synology DSM, QNAP QTS, TrueNAS, etc.)
- Docker installed
- Docker Compose installed
- SSH access

### Check Docker Installation
```bash
docker --version
docker-compose --version
# or
docker compose version
```

## Quick Deployment

### 1. Upload Files to NAS

Use SCP or SFTP to upload the entire `app` folder to your NAS:

```bash
# Execute from local computer (Windows use PowerShell or Git Bash)
scp -r app/ user@nas-ip:/volume1/docker/glyphforge/

# Or use rsync (recommended)
rsync -avz --progress app/ user@nas-ip:/volume1/docker/glyphforge/
```

### 2. SSH Connect to NAS

```bash
ssh user@nas-ip
cd /volume1/docker/glyphforge
```

### 3. Configure Volume Path

Edit `docker-compose.yml` or use NAS-specific configuration:

```bash
# Method 1: Edit docker-compose.yml directly
nano docker-compose.yml

# Method 2: Use NAS-specific configuration
cp docker-compose.nas.yml docker-compose.yml
nano docker-compose.yml
```

Modify the volume path to your actual NAS path:
```yaml
volumes:
  - /volume1/your-path/prompt:/data/prompt
```

### 4. Run Deployment Script

```bash
# Add execute permission
chmod +x deploy-nas.sh

# Execute deployment
./deploy-nas.sh
```

## Manual Deployment Steps

If you want to manually control each step:

### 1. Build Docker Image
```bash
docker build -t glyphforge .
```

### 2. Start Container
```bash
# Using docker compose v2
docker compose up -d

# Or using legacy docker-compose
docker-compose up -d
```

### 3. Check Status
```bash
docker ps -f name=glyphforge-app
docker logs glyphforge-app
```

## Common NAS Configurations

### Synology DSM

1. **Enable SSH**
   - Control Panel → Terminal & SNMP → Enable SSH service

2. **Install Docker**
   - Package Center → Search "Docker" → Install

3. **Path Example**
   ```yaml
   volumes:
     - /volume1/docker/glyphforge-data/prompt:/data/prompt
   ```

4. **Firewall Settings**
   - Control Panel → Security → Firewall
   - Allow ports 5173 and 3001

### QNAP QTS

1. **Enable SSH**
   - Control Panel → Network & File Services → Telnet / SSH

2. **Install Container Station**
   - App Center → Container Station

3. **Path Example**
   ```yaml
   volumes:
     - /share/Container/glyphforge-data/prompt:/data/prompt
   ```

### TrueNAS / FreeNAS

1. **Enable SSH**
   - Services → SSH → Start

2. **Path Example**
   ```yaml
   volumes:
     - /mnt/tank/docker/glyphforge-data/prompt:/data/prompt
   ```

## Network Configuration

### LAN Access
After the container starts, you can access it via:

```bash
# Local access
http://localhost:5173

# LAN access (other devices)
http://NAS-IP:5173

# Example
http://192.168.1.100:5173
```

### Setup Reverse Proxy (Recommended)

#### Nginx Reverse Proxy Example
```nginx
server {
    listen 80;
    server_name glyphforge.local;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

#### Synology Built-in Reverse Proxy
1. Control Panel → Login Portal → Advanced → Reverse Proxy
2. Create new rule:
   - Source: `https://glyphforge.your-domain.com`
   - Destination: `http://localhost:5173`

## Security Recommendations

### 1. Restrict Access
```bash
# Allow local access only (docker-compose.yml)
ports:
  - "127.0.0.1:3001:3001"
  - "127.0.0.1:5173:5173"
```

### 2. Use Firewall
```bash
# UFW example
sudo ufw allow from 192.168.1.0/24 to any port 5173
sudo ufw allow from 192.168.1.0/24 to any port 3001
```

### 3. Setup HTTPS
Using Let's Encrypt and Nginx:
```bash
certbot --nginx -d glyphforge.your-domain.com
```

## Monitoring and Maintenance

### View Logs
```bash
# Real-time logs
docker logs -f glyphforge-app

# Last 100 lines
docker logs --tail 100 glyphforge-app

# docker-compose logs
docker-compose logs -f
```

### Resource Monitoring
```bash
# Real-time resource usage
docker stats glyphforge-app

# One-time view
docker stats --no-stream glyphforge-app
```

### Auto Restart
Configured in `docker-compose.yml`:
```yaml
restart: unless-stopped
```

### Regular Updates
```bash
# Redeploy
./deploy-nas.sh

# Or manually
docker-compose down
docker-compose up -d --build
```

## Backup and Restore

### Backup
```bash
# Backup container
docker commit glyphforge-app glyphforge-backup

# Export image
docker save glyphforge-backup > glyphforge-backup.tar

# Backup volume data
tar -czf prompt-backup.tar.gz /volume1/your-path/prompt/
```

### Restore
```bash
# Import image
docker load < glyphforge-backup.tar

# Restore volume data
tar -xzf prompt-backup.tar.gz -C /
```

## Troubleshooting

### Container Won't Start
```bash
# Check detailed errors
docker logs glyphforge-app

# Check configuration
docker-compose config

# Check port usage
netstat -tlnp | grep -E ':(5173|3001)'
```

### Volume Permission Issues
```bash
# Check directory permissions
ls -la /volume1/your-path/prompt/

# Fix permissions
sudo chown -R 1000:1000 /volume1/your-path/prompt/
sudo chmod -R 755 /volume1/your-path/prompt/
```

### Network Issues
```bash
# Check container network
docker network inspect bridge

# Check container IP
docker inspect glyphforge-app | grep IPAddress
```

### Out of Memory
```bash
# Clean unused resources
docker system prune -a

# Check disk space
df -h

# Limit container resources (docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 1G
```

## Mobile Device Access

### LAN
Direct access to NAS IP:
```
http://192.168.1.100:5173
```

### External Access (requires DDNS setup)
1. Setup DDNS
2. Router port forwarding: 5173 → NAS:5173
3. Access: `http://your-ddns.com:5173`

### Using Tailscale (Recommended)
Secure remote access solution:
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Connect
tailscale up
```

## Technical Support

### Useful Commands
```bash
# Check system info
uname -a
docker info

# Check disk space
df -h

# Check memory
free -h

# Check network
ip addr show
```

### Export Configuration
```bash
# Export current configuration
docker-compose config > current-config.yml

# Export environment variables
docker inspect glyphforge-app | grep -A 10 "Env"
```
