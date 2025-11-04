# Admin User Setup Guide

## Creating an Admin User

There are **no default admin credentials**. You need to create an admin user first.

### Method 1: Using the Script (Recommended)

1. Navigate to the backend directory:
```bash
cd careersbackend
```

2. Run the admin creation script:
```bash
node src/scripts/createAdmin.js
```

This will create an admin user with default credentials:
- **Email**: `admin@trizenventures.com`
- **Username**: `admin`
- **Password**: `Admin@123`

3. **Custom Admin User** (with custom credentials):
```bash
node src/scripts/createAdmin.js <email> <password> <username> <firstName> <lastName>
```

Example:
```bash
node src/scripts/createAdmin.js admin@trizen.com MySecurePass123 adminuser Admin AdminUser
```

### Method 2: Using MongoDB Directly

1. Connect to your MongoDB database
2. Navigate to the `users` collection
3. Create a new user document or update an existing user:

```javascript
// Create new admin user
db.users.insertOne({
  username: "admin",
  email: "admin@trizenventures.com",
  password: "$2a$12$...", // Use bcrypt to hash password
  firstName: "Admin",
  lastName: "User",
  role: "admin",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})

// OR update existing user to admin
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

### Method 3: Using the Registration API + Manual Update

1. Register a user via the API:
```bash
POST http://localhost:5000/api/v1/users/register
{
  "username": "admin",
  "email": "admin@trizenventures.com",
  "password": "Admin@123",
  "firstName": "Admin",
  "lastName": "User"
}
```

2. Then update the user's role to `admin` in MongoDB:
```javascript
db.users.updateOne(
  { email: "admin@trizenventures.com" },
  { $set: { role: "admin" } }
)
```

## Login to Admin Panel

Once you have created an admin user:

1. Start the admin frontend:
```bash
cd careers-admin-frontend
npm run dev
```

2. Navigate to: `http://localhost:3001`

3. Login with:
   - **Email**: The email you used when creating the admin user
   - **Password**: The password you set

## Security Notes

- ⚠️ **Change the default password** after first login
- ⚠️ **Use strong passwords** for admin accounts
- ⚠️ **Keep admin credentials secure**
- ⚠️ **Only create admin users for trusted personnel**

## Troubleshooting

### "Access denied. Admin privileges required."
- Make sure the user's `role` field is set to `'admin'` (not `'user'`)
- Check the user exists in the database
- Verify the user's `isActive` field is `true`

### "Invalid credentials"
- Verify the email and password are correct
- Check that the user exists in the database
- Ensure the backend is running and connected to MongoDB

### Script fails with connection error
- Verify `MONGODB_URI` is set in your `.env` file
- Check MongoDB connection string is correct
- Ensure MongoDB is accessible

