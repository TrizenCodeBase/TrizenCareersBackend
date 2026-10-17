# Backend Deployment Guide

## CapRover Deployment

### Prerequisites
- CapRover instance running
- MongoDB database (can be local or cloud)
- Domain/subdomain configured in CapRover

### Environment Variables
Set these in CapRover app settings:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://careers.trizenventures.com,http://localhost:8080,http://localhost:3000
FRONTEND_URL=https://careers.trizenventures.com
API_VERSION=v1
API_PREFIX=/api
CAPROVER_GIT_COMMIT_SHA=latest
MINIO_ENDPOINT=http://srv-captain--trizencareer-minio-api
MINIO_PUBLIC_ENDPOINT=https://trizencareer-minio-api.llp.trizenventures.com
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET=careers-resumes
```

`MINIO_ENDPOINT` must be reachable from the backend and point to the MinIO **S3 API**, not its console. The CapRover HTTP Settings screenshot shows the internal service URL as `http://srv-captain--trizencareer-minio-api` (without an explicit port), and its public URL as `https://trizencareer-minio-api.llp.trizenventures.com`. Use the internal URL when the backend runs in the same CapRover network; use the public URL when the backend runs locally. Ensure the MinIO API app is running and its configured container HTTP port forwards to the S3 API.

If the backend runs locally (for example, on Windows), the CapRover-only hostname `srv-captain--...` will not resolve. Set `MINIO_ENDPOINT` to the MinIO S3 API's externally reachable HTTPS URL instead; use that same URL as `MINIO_PUBLIC_ENDPOINT` if the frontend needs direct presigned links. Do not expose the MinIO console port as the S3 endpoint.

The backend proxies resume files through `/api/v1/applications/resume`. A missing object returns `404`; an unreachable or misconfigured MinIO endpoint returns `502` so a network failure is not mistaken for a deleted resume.

### Build Arguments
The Dockerfile now properly accepts all build arguments, eliminating the warning about unused build arguments. The following build arguments are supported:

- `NODE_ENV` - Environment (default: production)
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - JWT expiration time
- `ALLOWED_ORIGINS` - CORS allowed origins
- `FRONTEND_URL` - Frontend application URL
- `API_VERSION` - API version
- `API_PREFIX` - API prefix
- `CAPROVER_GIT_COMMIT_SHA` - Git commit SHA for versioning

### Deployment Steps

1. **Push to Git Repository**
   ```bash
   git add .
   git commit -m "Fix Docker build arguments and healthcheck"
   git push origin main
   ```

2. **Deploy via CapRover Dashboard**
   - Go to CapRover dashboard
   - Create new app (e.g., `careers-backend`)
   - Connect your Git repository
   - Set branch to `main`
   - Deploy

3. **Configure Environment Variables**
   - In app settings, add all required environment variables
   - Save and redeploy

4. **Verify Deployment**
   - Check health endpoint: `https://your-backend-domain.com/api/health`
   - Should return: `{"success":true,"message":"Health check passed"}`

### Health Check
The app includes a health check at `/api/health` that CapRover uses to monitor the application. The healthcheck has been updated to use ES modules syntax.

### API Endpoints
- **Health Check**: `GET /api/health`
- **Root**: `GET /` - Returns server status
- **Applications**: `GET /api/v1/applications`
- **Submit Application**: `POST /api/v1/applications`
- **User Registration**: `POST /api/v1/users/register`
- **User Login**: `POST /api/v1/users/login`

### Troubleshooting
- Check CapRover logs for any build or runtime errors
- Verify MongoDB connection string is correct
- Ensure all environment variables are set
- Check if the port 5000 is accessible
- The build should now complete without warnings about unused build arguments

### Recent Fixes
- ✅ Fixed Docker build arguments warning by adding ARG instructions
- ✅ Updated healthcheck.js to use ES modules syntax
- ✅ Added all required environment variables to captain-definition
- ✅ Improved deployment configuration
