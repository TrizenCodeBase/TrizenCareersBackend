# Trizen Careers Backend API

A Node.js backend API for the Trizen Careers website with user authentication using MongoDB.

## Features

- User registration and login
- JWT-based authentication
- Password hashing with bcrypt
- Input validation
- Error handling
- Rate limiting
- CORS support
- MongoDB integration

## Prerequisites

- Node.js (v18 or higher)
- MongoDB cluster URL
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://your_username:your_password@your_cluster_url/your_database_name
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=7d
   ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000
   API_VERSION=v1
   API_PREFIX=/api
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

#### Register User
- **POST** `/api/v1/users/register`
- **Body:**
  ```json
  {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }
  ```

#### Login User
- **POST** `/api/v1/users/login`
- **Body:**
  ```json
  {
    "username": "johndoe",
    "password": "password123"
  }
  ```

### User Profile

#### Get Current User Profile
- **GET** `/api/v1/users/profile`
- **Headers:** `Authorization: Bearer <token>`

#### Update User Profile
- **PUT** `/api/v1/users/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@example.com"
  }
  ```

#### Change Password
- **PUT** `/api/v1/users/change-password`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "currentPassword": "oldpassword",
    "newPassword": "newpassword123"
  }
  ```

### Admin Only

#### Get All Users
- **GET** `/api/v1/users?page=1&limit=10&search=john`
- **Headers:** `Authorization: Bearer <token>`
- **Access:** Admin only

### Other Endpoints

#### Health Check
- **GET** `/health`

#### API Documentation
- **GET** `/api/v1/docs`

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Validation Rules

### User Registration
- Username: 3-30 characters, alphanumeric and underscores only
- Email: Valid email format
- Password: Minimum 6 characters
- First Name: 2-50 characters
- Last Name: 2-50 characters

### User Login
- Username: Required
- Password: Required

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid credentials, missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- Input validation and sanitization

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | Required |
| `JWT_SECRET` | JWT secret key | Required |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `ALLOWED_ORIGINS` | CORS allowed origins | localhost:3000,8080 |
| `API_VERSION` | API version | v1 |
| `API_PREFIX` | API prefix | /api |
