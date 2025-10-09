# Environment Variables Template

Copy this to `.env` and fill in your values:

```bash
# ==========================================
# CORE CONFIGURATION
# ==========================================

NODE_ENV=development
PORT=3000

# ==========================================
# DATABASE
# ==========================================

# Local MongoDB
MONGO_URI=mongodb://localhost:27017/karaoke-gigante

# Or MongoDB Atlas
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/karaoke-gigante?retryWrites=true&w=majority

# ==========================================
# CLERK AUTHENTICATION & ORGANIZATIONS
# ==========================================

# Get these from: https://dashboard.clerk.com
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ==========================================
# UPSTASH REDIS (OPTIONAL - for caching & queue)
# ==========================================

# Get from: https://console.upstash.com
# UPSTASH_REDIS_REST_URL=https://xxxxxxxx.upstash.io
# UPSTASH_REDIS_REST_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ==========================================
# UPSTASH QSTASH (OPTIONAL - for background jobs)
# ==========================================

# Get from: https://console.upstash.com/qstash
# QSTASH_URL=https://qstash.upstash.io
# QSTASH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# QSTASH_CURRENT_SIGNING_KEY=sig_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# QSTASH_NEXT_SIGNING_KEY=sig_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ==========================================
# SPOTIFY API (OPTIONAL - for song search)
# ==========================================

# Get from: https://developer.spotify.com/dashboard
# SPOTIFY_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# SPOTIFY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ==========================================
# EXPO PUSH NOTIFICATIONS (OPTIONAL)
# ==========================================

# Get from: https://expo.dev/accounts/[username]/settings/access-tokens
# EXPO_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ==========================================
# CORS CONFIGURATION
# ==========================================

# Comma-separated list of allowed origins
# For Expo development:
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://localhost:19000,exp://192.168.1.100:8081,https://app.karaokegigante.com

# For production:
# CORS_ORIGINS=https://your-production-domain.com

# ==========================================
# RATE LIMITING
# ==========================================

RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000

# ==========================================
# REVENUECAT (OPTIONAL - for subscriptions)
# ==========================================

# REVENUECAT_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Quick Setup Guide

### 1. Create Clerk Account

1. Go to https://dashboard.clerk.com
2. Create new application
3. Enable **Organizations** feature
4. Copy your Secret Key and Publishable Key

### 2. Setup MongoDB

**Option A: Local**

```bash
brew install mongodb-community
brew services start mongodb-community
```

**Option B: MongoDB Atlas**

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string

### 3. Setup Expo Push Notifications

1. Go to https://expo.dev
2. Navigate to Account Settings > Access Tokens
3. Create new token

### 4. (Optional) Setup Upstash

1. Go to https://console.upstash.com
2. Create Redis database
3. Create QStash project
4. Copy credentials

### 5. Start Development Server

```bash
npm run dev
```

Server will start on http://localhost:3000

## Testing

Test the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
	"status": "ok",
	"timestamp": "2024-01-08T12:00:00.000Z",
	"environment": "development"
}
```
