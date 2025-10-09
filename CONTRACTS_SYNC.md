# API Contract Synchronization Guide

## 🔄 Automatic Contract Sync (Development Only)

Since frontend and backend are in separate directories, we've implemented HTTP endpoints to share API contracts automatically.

---

## 📡 Dev Endpoints for Contract Sync

### GET /api/dev/contracts

**Purpose:** Fetch the latest API contracts from backend
**Environment:** Development only
**Returns:** TypeScript contract file with version info

**Response:**

```json
{
	"version": "1.0.0",
	"lastUpdated": "2024-01-08",
	"content": "... full TypeScript file content ...",
	"fileModified": "2024-01-08T12:00:00.000Z",
	"instructions": {
		"usage": "Save this content to your frontend: src/types/api-contracts.ts",
		"checkVersion": "Compare version before updating to prevent downgrade",
		"breaking": "Major version changes (e.g., 1.x.x -> 2.x.x) may have breaking changes"
	}
}
```

### POST /api/dev/contracts/verify

**Purpose:** Verify frontend version matches backend
**Environment:** Development only
**Body:**

```json
{
	"frontendVersion": "1.0.0"
}
```

**Response:**

```json
{
	"matches": true,
	"compatible": true,
	"backendVersion": "1.0.0",
	"frontendVersion": "1.0.0",
	"message": "✅ Frontend and backend API contracts are in sync",
	"severity": "ok",
	"shouldUpdate": false
}
```

**Severity Levels:**

- `ok` - Versions match perfectly
- `warning` - Minor/patch version mismatch (compatible)
- `error` - Major version mismatch (breaking change)

---

## 🎯 Frontend Implementation

### 1. Create Sync Script

**File:** `scripts/sync-api-contracts.js` (or .ts)

```javascript
#!/usr/bin/env node

import fs from "fs";
import path from "path";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const CONTRACTS_PATH = path.join(process.cwd(), "src/types/api-contracts.ts");

async function syncContracts() {
	console.log("🔄 Syncing API contracts from backend...\n");

	try {
		// Fetch contracts
		const response = await fetch(`${API_URL}/api/dev/contracts`);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		console.log(`📦 Backend version: ${data.version}`);
		console.log(`📅 Last updated: ${data.lastUpdated}\n`);

		// Check if we have existing contracts
		let shouldUpdate = true;
		if (fs.existsSync(CONTRACTS_PATH)) {
			const existing = fs.readFileSync(CONTRACTS_PATH, "utf-8");
			const versionMatch = existing.match(/Version:\s*(\d+\.\d+\.\d+)/);

			if (versionMatch) {
				const currentVersion = versionMatch[1];
				console.log(`📦 Current version: ${currentVersion}`);

				// Verify version
				const verifyResponse = await fetch(
					`${API_URL}/api/dev/contracts/verify`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ frontendVersion: currentVersion }),
					}
				);

				const verification = await verifyResponse.json();
				console.log(`\n${verification.message}\n`);

				if (verification.severity === "error") {
					console.error("❌ Breaking change detected!");
					console.error("   Manual review required before updating.");
					console.error("   See CONTRACTS_SYNC.md for migration guide.\n");
					process.exit(1);
				}

				if (!verification.shouldUpdate) {
					console.log("✅ Already up to date!\n");
					return;
				}
			}
		}

		// Update contracts
		fs.mkdirSync(path.dirname(CONTRACTS_PATH), { recursive: true });
		fs.writeFileSync(CONTRACTS_PATH, data.content);

		console.log("✅ API contracts updated successfully!");
		console.log(`📝 Written to: ${CONTRACTS_PATH}\n`);
		console.log("💡 Next steps:");
		console.log("   1. Review changes: git diff src/types/api-contracts.ts");
		console.log("   2. Update code if needed");
		console.log("   3. Run tests: npm test\n");
	} catch (error) {
		console.error("❌ Failed to sync contracts:", error.message);
		console.error("\n💡 Make sure backend is running: npm run dev\n");
		process.exit(1);
	}
}

syncContracts();
```

### 2. Add to package.json

```json
{
	"scripts": {
		"sync-contracts": "node scripts/sync-api-contracts.js",
		"dev": "npm run sync-contracts && expo start",
		"pretest": "npm run sync-contracts"
	}
}
```

### 3. Usage

```bash
# Manual sync
npm run sync-contracts

# Auto-sync before dev
npm run dev

# Auto-sync before tests
npm test
```

---

## 🔒 Version Control

### Semantic Versioning

**Format:** `MAJOR.MINOR.PATCH`

**Rules:**

- **MAJOR** (1.x.x → 2.x.x): Breaking changes

  - Changed field types
  - Removed required fields
  - Changed status enums
  - Changed endpoints

- **MINOR** (x.1.x → x.2.x): New features (backward compatible)

  - New optional fields
  - New endpoints
  - New status values

- **PATCH** (x.x.1 → x.x.2): Bug fixes
  - Documentation updates
  - Comment changes
  - No API changes

### Version Check Matrix

| Backend | Frontend | Severity   | Action                                   |
| ------- | -------- | ---------- | ---------------------------------------- |
| 1.0.0   | 1.0.0    | ✅ OK      | None - Perfect match                     |
| 1.1.0   | 1.0.0    | ⚠️ Warning | Update frontend (new features available) |
| 1.0.1   | 1.0.0    | ⚠️ Warning | Update frontend (bug fixes)              |
| 2.0.0   | 1.0.0    | ❌ Error   | BREAKING - Manual migration required     |
| 1.0.0   | 2.0.0    | ❌ Error   | Invalid - Frontend ahead of backend      |

---

## 🚨 Breaking Change Protocol

### When Backend Makes Breaking Change

1. **Update version to 2.0.0** in `src/types/api-contracts.ts`
2. **Document migration** in `MIGRATION.md`
3. **Post to logs/cursor.log**:
   ```
   AGENT: backend
   BREAKING CHANGE: v1.0.0 → v2.0.0
   CHANGES:
     - Changed queuePosition to 0-based (was 1-based)
     - Removed user.displayName (use user.username)
   MIGRATION: See MIGRATION.md
   ```
4. **Frontend blocks auto-update** and requires manual review

### Frontend Migration Steps

1. **Sync script detects breaking change** and exits with error
2. **Developer reviews** `logs/cursor.log` and `MIGRATION.md`
3. **Developer updates code** to handle new contracts
4. **Developer manually updates** contracts:
   ```bash
   npm run sync-contracts -- --force
   ```
5. **Developer tests** thoroughly
6. **Developer commits** changes

---

## 🧪 Testing Contract Sync

### Backend Test

```bash
# Start backend
cd backend
npm run dev

# Test contracts endpoint
curl http://localhost:3000/api/dev/contracts | jq '.version'
```

### Frontend Test

```bash
# Run sync script
cd frontend
npm run sync-contracts

# Verify file updated
cat src/types/api-contracts.ts | grep "Version:"
```

### Version Verification Test

```bash
# Check if in sync
curl -X POST http://localhost:3000/api/dev/contracts/verify \
  -H "Content-Type: application/json" \
  -d '{"frontendVersion":"1.0.0"}' | jq
```

---

## 📋 CI/CD Integration

### GitHub Actions Example

```yaml
name: Frontend CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      backend:
        image: node:18
        # ... backend service config

    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm install

      - name: Wait for backend
        run: npx wait-on http://localhost:3000/health

      - name: Sync API contracts
        run: npm run sync-contracts

      - name: Verify contracts are in sync
        run: |
          if git diff --quiet src/types/api-contracts.ts; then
            echo "✅ Contracts in sync"
          else
            echo "❌ Contracts out of sync - commit required"
            git diff src/types/api-contracts.ts
            exit 1
          fi

      - name: Run tests
        run: npm test
```

---

## 🔍 Monitoring

### Log Contract Syncs

Backend automatically logs:

```
[INFO] API contracts requested - version 1.0.0
[INFO] Contract verification: ✅ Frontend and backend API contracts are in sync
```

### Alert on Mismatch

Frontend can alert developers:

```javascript
// In app startup
async function checkContractVersion() {
	if (process.env.NODE_ENV === "development") {
		const response = await fetch(`${API_URL}/api/dev/contracts/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ frontendVersion: "1.0.0" }),
		});

		const result = await response.json();

		if (result.severity === "error") {
			console.error("⚠️ API CONTRACT MISMATCH:", result.message);
			// Show dev warning banner
		}
	}
}
```

---

## ✅ Best Practices

1. **Always sync before development**

   ```bash
   npm run dev  # Auto-syncs contracts first
   ```

2. **Verify after syncing**

   ```bash
   git diff src/types/api-contracts.ts
   ```

3. **Run tests after sync**

   ```bash
   npm test
   ```

4. **Commit contract changes separately**

   ```bash
   git add src/types/api-contracts.ts
   git commit -m "chore: sync API contracts to v1.1.0"
   ```

5. **Review breaking changes carefully**
   - Read migration guide
   - Update code first
   - Test thoroughly
   - Only then sync contracts

---

## 📞 Troubleshooting

### "Backend not running"

```bash
# Start backend first
cd ../backend && npm run dev
```

### "Version mismatch error"

```bash
# Force sync (use carefully!)
npm run sync-contracts -- --force

# Or manually review and update
curl http://localhost:3000/api/dev/contracts > temp.json
# Review changes
# Copy to src/types/api-contracts.ts
```

### "Breaking change detected"

1. Read backend's `logs/cursor.log`
2. Check for MIGRATION.md
3. Update your code first
4. Then sync contracts
5. Test everything

---

## 🎯 Quick Reference

```bash
# Sync contracts from backend
npm run sync-contracts

# Check if in sync
curl -X POST localhost:3000/api/dev/contracts/verify \
  -H "Content-Type: application/json" \
  -d '{"frontendVersion":"1.0.0"}'

# Get contracts manually
curl localhost:3000/api/dev/contracts > contracts.json

# Start dev with auto-sync
npm run dev
```

---

**Environment:** Development only (NODE_ENV=development)
**Backend Endpoint:** `http://localhost:3000/api/dev/contracts`
**Frontend Script:** `npm run sync-contracts`
**Version Control:** Semantic Versioning (MAJOR.MINOR.PATCH)
