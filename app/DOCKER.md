# Glyphforge Docker Deployment Guide

## Quick Start

### Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose

### One-Click Deployment

#### Windows (PowerShell)
```powershell
.\deploy.ps1
```

#### Linux/Mac (Bash)
```bash
chmod +x deploy.sh
./deploy.sh
```

## Detailed Instructions

### File Structure
```
app/
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Docker Compose configuration
├── config.json            # Local development configuration
├── config.docker.json     # Docker container configuration
├── deploy.ps1             # Windows deployment script
└── deploy.sh              # Linux/Mac deployment script
```

### Manual Deployment Steps

1. **Build Docker Image**
   ```bash
   docker build -t glyphforge .
   ```

2. **Start Container**
   ```bash
   docker-compose up -d
   ```

3. **View Logs**
   ```bash
   docker-compose logs -f
   ```

4. **Stop Container**
   ```bash
   docker-compose down
   ```

### Volume Configuration

The container will automatically mount the host's prompt folder:
- Host path: `D:/Glyphforge-data/prompt`
- Container path: `/data/prompt`

If your data is in a different location, modify the volumes setting in `docker-compose.yml`:
```yaml
volumes:
  - /your/path/to/prompt:/data/prompt
```

### Port Configuration

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

To modify ports, edit `docker-compose.yml`:
```yaml
ports:
  - "your-port:3001"
  - "your-port:5173"
```

## FAQ

### Q: How to update the application?
A: Running the deployment script will automatically stop the old container and create a new one:
```powershell
.\deploy.ps1
```

### Q: How to check container status?
A: Use the following command:
```bash
docker ps -f name=glyphforge-app
```

### Q: How to enter the container?
A: Use the following command:
```bash
docker exec -it glyphforge-app sh
```

### Q: What about folder permission issues?
A: Ensure Docker has permission to access `D:/Glyphforge-data/prompt`:
- Windows: Allow the drive in Docker Desktop settings
- Linux: Ensure folder permissions are correct `chmod -R 755 /path/to/prompt`

## Development Mode vs Production Mode

### Development Mode (current configuration)
- Uses `npm start` to run both frontend and backend
- Supports hot reload
- Suitable for development and testing

### Production Mode (optional)
For production deployment, it is recommended to:
1. Use Nginx to serve static files
2. Separate frontend and backend containers
3. Use production build

## Advanced Configuration

### Using Environment Variables
Add environment variables in `docker-compose.yml`:
```yaml
environment:
  - NODE_ENV=production
  - CUSTOM_VAR=value
```

### Persistent Logs
Add log volume:
```yaml
volumes:
  - D:/Glyphforge-data/prompt:/data/prompt
  - ./logs:/app/logs
```

### Multiple Instances
Copy `docker-compose.yml` and modify:
- Container name
- Port mapping
- Volume path

## Security Recommendations

1. Don't expose ports to the public internet
2. Use reverse proxy (Nginx/Traefik)
3. Regularly update Docker images
4. Limit container resource usage

## Troubleshooting

### Container Won't Start
```bash
# View detailed logs
docker-compose logs

# Check configuration
docker-compose config
```

### Cannot Access Folder
```bash
# Check volume mount
docker inspect glyphforge-app

# Enter container to check
docker exec -it glyphforge-app ls -la /data/prompt
```

### Port Already in Use
```bash
# Check port usage
netstat -ano | findstr :5173
netstat -ano | findstr :3001

# Modify port in docker-compose.yml
```
