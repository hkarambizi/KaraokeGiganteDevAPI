# Shared Documentation Folder

This folder contains documentation uploaded by the **frontend agent** for the backend to read.

## 📁 What Goes Here

Frontend uploads documentation via:

```bash
POST /api/dev/docs/:filename
```

Examples:

- `FRONTEND_GUIDE.md` - Frontend architecture
- `COMPONENT_LIBRARY.md` - Component documentation
- `TESTING_GUIDE.md` - Frontend testing approach
- `SCREEN_FLOWS.md` - User flow documentation
- `STATE_MANAGEMENT.md` - Redux patterns
- `API_CLIENT.md` - kgSDK.ts documentation

## 🔄 How It Works

1. **Frontend creates docs** in their `docs/` folder
2. **Frontend runs:** `npm run upload-docs`
3. **Backend receives** docs via POST endpoint
4. **Docs saved** to this `docs/shared/` folder
5. **Backend can read** anytime via filesystem

## 📖 Reading Shared Docs

Backend can read directly:

```javascript
import fs from "fs";
const content = fs.readFileSync("./docs/shared/FRONTEND_GUIDE.md", "utf-8");
```

Or via HTTP (for consistency):

```bash
curl http://localhost:3000/api/dev/docs/FRONTEND_GUIDE.md
```

## 🗑️ Cleanup

Remove outdated docs:

```bash
curl -X DELETE http://localhost:3000/api/dev/docs/OLD_DOC.md
```

Or manually:

```bash
rm docs/shared/OLD_DOC.md
```

## 📊 Current Status

```
Backend docs → Auto-served via HTTP
Frontend docs → Uploaded to this folder
Shared access → Both agents can read all docs
```

---

**Location:** `docs/shared/`
**Populated by:** Frontend agent
**Readable by:** Backend agent
**Updated:** Automatically via HTTP endpoints
