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
ALLOWED_ORIGINS=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com
```

### Deployment Steps

1. **Push to Git Repository**
   ```bash
   git add .
   git commit -m "Deploy backend to CapRover"
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
   - Should return: `{"success":true,"message":"Server is running"}`

### Health Check
The app includes a health check at `/api/health` that CapRover uses to monitor the application.

### API Endpoints
- **Health Check**: `GET /api/health`
- **Applications**: `GET /api/v1/applications`
- **Submit Application**: `POST /api/v1/applications`
- **User Registration**: `POST /api/v1/users/register`
- **User Login**: `POST /api/v1/users/login`

### Troubleshooting
- Check CapRover logs for any build or runtime errors
- Verify MongoDB connection string is correct
- Ensure all environment variables are set
- Check if the port 5000 is accessible
