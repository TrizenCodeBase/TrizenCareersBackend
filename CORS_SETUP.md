# CORS Configuration for Trizen Careers Backend

## Overview

This document outlines the CORS (Cross-Origin Resource Sharing) configuration implemented to allow secure communication between the frontend and backend applications.

## Frontend Domain

**Production Frontend**: [https://careers.trizenventures.com/](https://careers.trizenventures.com/)

## CORS Configuration

### Allowed Origins

The backend now allows requests from the following origins:

- ✅ **https://careers.trizenventures.com** - Production frontend
- ✅ **http://localhost:8080** - Local development frontend
- ✅ **http://localhost:3000** - Alternative local development port

### CORS Headers

The backend sends the following CORS headers:

```http
Access-Control-Allow-Origin: [Origin] (dynamic based on request origin)
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

### Implementation Details

#### 1. Server Configuration

**`server-simple.js`** (Simple server):
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:8080', 'https://careers.trizenventures.com'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**`server.js`** (Full server):
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:8080'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### 2. Environment Variables

**`.env.example`**:
```bash
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000,https://careers.trizenventures.com
FRONTEND_URL=https://careers.trizenventures.com
```

**`captain-definition`**:
```json
{
  "environmentVariables": [
    {
      "key": "ALLOWED_ORIGINS",
      "value": "https://careers.trizenventures.com,http://localhost:8080,http://localhost:3000"
    },
    {
      "key": "FRONTEND_URL",
      "value": "https://careers.trizenventures.com"
    }
  ]
}
```

## Testing CORS

### Test Script

Run the CORS test to verify configuration:

```bash
npm run test:cors
```

### Manual Testing

Test CORS headers using curl:

```bash
# Test production frontend origin
curl -H "Origin: https://careers.trizenventures.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://trizencareersbackend.llp.trizenventures.com/api/health

# Test local development origin
curl -H "Origin: http://localhost:8080" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://trizencareersbackend.llp.trizenventures.com/api/health
```

### Expected Results

- ✅ **https://careers.trizenventures.com** - Should return CORS headers
- ✅ **http://localhost:8080** - Should return CORS headers
- ✅ **http://localhost:3000** - Should return CORS headers
- ❌ **https://malicious-site.com** - Should be blocked

## Security Features

1. **Origin Validation**: Only pre-approved origins are allowed
2. **Method Restriction**: Limited to specific HTTP methods
3. **Header Restriction**: Only necessary headers are allowed
4. **Credentials Support**: Supports authenticated requests
5. **Dynamic Origin**: CORS headers are set based on the requesting origin

## Deployment

### CapRover Deployment

The CORS configuration is automatically applied when deploying to CapRover through the `captain-definition` file.

### Environment Variables

Set these environment variables in your deployment platform:

```bash
ALLOWED_ORIGINS=https://careers.trizenventures.com,http://localhost:8080,http://localhost:3000
FRONTEND_URL=https://careers.trizenventures.com
```

## Troubleshooting

### Common CORS Issues

1. **Origin Not Allowed**: Check if the frontend domain is in `ALLOWED_ORIGINS`
2. **Missing Headers**: Ensure `Content-Type` and `Authorization` are included
3. **Method Not Allowed**: Verify the HTTP method is in the allowed list
4. **Credentials Issue**: Check if `credentials: true` is set in frontend requests

### Debug Steps

1. Check browser console for CORS errors
2. Verify environment variables are set correctly
3. Test with the CORS test script
4. Check server logs for CORS rejection messages

## Frontend Integration

The frontend should include the following in fetch requests:

```typescript
const response = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // if authenticated
  },
  credentials: 'include', // for cookies if needed
  body: JSON.stringify(data)
});
```

## Updates Made

- ✅ Added `https://careers.trizenventures.com` to allowed origins
- ✅ Updated CORS configuration in both server files
- ✅ Updated environment configuration files
- ✅ Created CORS test script
- ✅ Updated deployment documentation
- ✅ Added security headers and validation
