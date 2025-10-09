# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file:

```bash
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/karaoke-gigante
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://localhost:19000
```

**Where to get your keys:**

- **MongoDB**: Local install or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier)
- **Clerk Keys**: [Clerk Dashboard](https://dashboard.clerk.com) → Create Application → API Keys

### 3. Start MongoDB (if local)

```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

### 4. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### 5. Test the Server

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-08T...","environment":"development"}
```

## ✅ You're Ready!

The backend is now running and ready to accept requests from the frontend.

### Next Steps

1. **Frontend Integration**: Update frontend `.env` with:

   ```
   EXPO_PUBLIC_API_URL=http://localhost:3000
   ```

2. **Test Authentication**: Use Clerk JWT token to call:

   ```bash
   curl -H "Authorization: Bearer YOUR_CLERK_JWT" \
     http://localhost:3000/api/users/me
   ```

3. **Create Organization** (Admin Setup):
   ```bash
   curl -X POST http://localhost:3000/api/orgs \
     -H "Authorization: Bearer YOUR_CLERK_JWT" \
     -H "Content-Type: application/json" \
     -d '{"name":"My Karaoke Venue"}'
   ```

## 📚 Documentation

- **Full README**: See `README.md`
- **API Reference**: See `.cursor/BACKEND_INTEGRATION_GUIDE.md`
- **Environment Template**: See `ENV_TEMPLATE.md`
- **Changelog**: See `logs/cursor.log`

## 🐛 Troubleshooting

**Error: Cannot connect to MongoDB**

- Make sure MongoDB is running
- Check your MONGO_URI in `.env`

**Error: Invalid Clerk credentials**

- Verify CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY
- Make sure keys match your Clerk application

**CORS errors from frontend**

- Add your frontend URL to CORS_ORIGINS in `.env`
- Format: `http://localhost:8081,http://192.168.1.100:8081`

## 🎯 Key Endpoints

```
Health Check:     GET  /health
User Profile:     GET  /api/users/me
Search Songs:     GET  /api/songs/search?q=bohemian
Create Event:     POST /api/events
Get Queue:        GET  /api/events/:id/queue
Register Device:  POST /api/devices/register
```

## 🔒 Authentication

All endpoints (except `/health` and dev endpoints) require:

```
Authorization: Bearer <clerk-jwt-token>
```

Get JWT token from Clerk session in your frontend:

```typescript
const { getToken } = useAuth();
const token = await getToken();
```

## 🎉 That's It!

You now have a fully functional backend API. Happy coding! 🚀
