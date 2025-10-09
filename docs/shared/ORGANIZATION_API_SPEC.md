# Organization API Specification

## Overview

This document specifies the API endpoints required for organization management in the Karaoke Gigante application. Organizations allow admins to manage karaoke events, with support for multi-tenancy, invitations, and role-based access control.

## Data Models

### Organization

```typescript
{
  _id: string;              // MongoDB ObjectId
  clerkOrgId: string;       // Clerk organization ID
  name: string;             // Organization name
  slug: string;             // URL-friendly slug (unique)
  logoUrl?: string;         // Optional logo URL
  createdBy: string;        // Clerk user ID of creator
  createdAt: string;        // ISO 8601 timestamp
  updatedAt: string;        // ISO 8601 timestamp
}
```

### OrganizationMember

```typescript
{
  userId: string;           // MongoDB user ID
  clerkUserId: string;      // Clerk user ID
  role: 'admin' | 'member'; // Member role
  joinedAt: string;         // ISO 8601 timestamp
  user?: User;              // Populated user object (optional)
}
```

### OrganizationInvite

```typescript
{
  _id: string;              // MongoDB ObjectId
  orgId: string;            // Organization ID
  email: string;            // Invitee email
  role: 'admin' | 'member'; // Invited role
  invitedBy: string;        // Clerk user ID of inviter
  clerkInviteId?: string;   // Clerk invitation ID (if using Clerk invites)
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;        // ISO 8601 timestamp (e.g., 7 days from creation)
  createdAt: string;        // ISO 8601 timestamp
  organization?: Organization; // Populated org object (optional)
  inviter?: User;           // Populated inviter object (optional)
}
```

## API Endpoints

### 1. Create Organization

**Endpoint:** `POST /api/orgs`

**Auth:** Required (JWT token)

**Request Body:**
```json
{
  "name": "My Karaoke Bar",
  "slug": "my-karaoke-bar",
  "logoUrl": "https://example.com/logo.png" // optional
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "clerkOrgId": "org_abc123",
  "name": "My Karaoke Bar",
  "slug": "my-karaoke-bar",
  "logoUrl": "https://example.com/logo.png",
  "createdBy": "user_xyz789",
  "createdAt": "2025-10-08T12:00:00Z",
  "updatedAt": "2025-10-08T12:00:00Z"
}
```

**Notes:**
- Creates organization in both MongoDB and Clerk
- Automatically adds creator as admin member
- Slug must be unique across all organizations
- Sets user's role to 'admin' in Clerk public metadata

---

### 2. List My Organizations

**Endpoint:** `GET /api/orgs/my`

**Auth:** Required (JWT token)

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "clerkOrgId": "org_abc123",
    "name": "My Karaoke Bar",
    "slug": "my-karaoke-bar",
    "logoUrl": "https://example.com/logo.png",
    "createdBy": "user_xyz789",
    "createdAt": "2025-10-08T12:00:00Z",
    "updatedAt": "2025-10-08T12:00:00Z"
  }
]
```

**Notes:**
- Returns all organizations where the authenticated user is a member
- Can query Clerk for user's organizations or maintain membership in MongoDB

---

### 3. Get Organization

**Endpoint:** `GET /api/orgs/:orgId`

**Auth:** Required (JWT token)

**Path Parameters:**
- `orgId` - Organization ID

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "clerkOrgId": "org_abc123",
  "name": "My Karaoke Bar",
  "slug": "my-karaoke-bar",
  "logoUrl": "https://example.com/logo.png",
  "createdBy": "user_xyz789",
  "createdAt": "2025-10-08T12:00:00Z",
  "updatedAt": "2025-10-08T12:00:00Z"
}
```

**Notes:**
- User must be a member of the organization
- Returns 403 if user is not a member

---

### 4. List Organization Members

**Endpoint:** `GET /api/orgs/:orgId/members`

**Auth:** Required (JWT token)

**Path Parameters:**
- `orgId` - Organization ID

**Response:** `200 OK`
```json
[
  {
    "userId": "507f1f77bcf86cd799439012",
    "clerkUserId": "user_xyz789",
    "role": "admin",
    "joinedAt": "2025-10-08T12:00:00Z",
    "user": {
      "_id": "507f1f77bcf86cd799439012",
      "clerkId": "user_xyz789",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "displayName": "John Doe"
    }
  }
]
```

**Notes:**
- User must be a member of the organization
- Populates user details for each member

---

### 5. Send Organization Invitation

**Endpoint:** `POST /api/orgs/:orgId/invites`

**Auth:** Required (JWT token, admin role)

**Path Parameters:**
- `orgId` - Organization ID

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role": "member" // or "admin"
}
```

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "orgId": "507f1f77bcf86cd799439011",
  "email": "newmember@example.com",
  "role": "member",
  "invitedBy": "user_xyz789",
  "clerkInviteId": "inv_abc123",
  "status": "pending",
  "expiresAt": "2025-10-15T12:00:00Z",
  "createdAt": "2025-10-08T12:00:00Z"
}
```

**Notes:**
- Only organization admins can send invitations
- Creates invitation in Clerk and MongoDB
- Sends email notification via Clerk
- Invitation expires in 7 days by default

---

### 6. List Organization Invitations

**Endpoint:** `GET /api/orgs/:orgId/invites`

**Auth:** Required (JWT token, admin role)

**Path Parameters:**
- `orgId` - Organization ID

**Query Parameters:**
- `status` - Filter by status (optional): `pending`, `accepted`, `revoked`

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439013",
    "orgId": "507f1f77bcf86cd799439011",
    "email": "newmember@example.com",
    "role": "member",
    "invitedBy": "user_xyz789",
    "clerkInviteId": "inv_abc123",
    "status": "pending",
    "expiresAt": "2025-10-15T12:00:00Z",
    "createdAt": "2025-10-08T12:00:00Z",
    "inviter": {
      "_id": "507f1f77bcf86cd799439012",
      "displayName": "John Doe",
      "email": "admin@example.com"
    }
  }
]
```

**Notes:**
- Only organization admins can view invitations
- Populates inviter details

---

### 7. List My Invitations

**Endpoint:** `GET /api/orgs/invites/my`

**Auth:** Required (JWT token)

**Response:** `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439013",
    "orgId": "507f1f77bcf86cd799439011",
    "email": "newmember@example.com",
    "role": "member",
    "invitedBy": "user_xyz789",
    "status": "pending",
    "expiresAt": "2025-10-15T12:00:00Z",
    "createdAt": "2025-10-08T12:00:00Z",
    "organization": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "My Karaoke Bar",
      "slug": "my-karaoke-bar",
      "logoUrl": "https://example.com/logo.png"
    },
    "inviter": {
      "_id": "507f1f77bcf86cd799439012",
      "displayName": "John Doe",
      "email": "admin@example.com"
    }
  }
]
```

**Notes:**
- Returns invitations for the authenticated user's email
- Populates organization and inviter details
- Only shows pending invitations

---

### 8. Accept Invitation

**Endpoint:** `POST /api/orgs/invites/:inviteId/accept`

**Auth:** Required (JWT token)

**Path Parameters:**
- `inviteId` - Invitation ID

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Notes:**
- User's email must match invitation email
- Adds user as member to organization in Clerk and MongoDB
- Updates invitation status to 'accepted'
- Returns 403 if email doesn't match or invitation expired

---

### 9. Decline Invitation

**Endpoint:** `POST /api/orgs/invites/:inviteId/decline`

**Auth:** Required (JWT token)

**Path Parameters:**
- `inviteId` - Invitation ID

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Notes:**
- User's email must match invitation email
- Updates invitation status to 'revoked' (or deletes it)
- Does not add user to organization

---

### 10. Revoke Invitation

**Endpoint:** `DELETE /api/orgs/invites/:inviteId/revoke`

**Auth:** Required (JWT token, admin role)

**Path Parameters:**
- `inviteId` - Invitation ID

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Notes:**
- Only organization admins can revoke invitations
- Updates invitation status to 'revoked'
- Revokes invitation in Clerk if `clerkInviteId` exists

---

### 11. Resend Invitation

**Endpoint:** `POST /api/orgs/invites/:inviteId/resend`

**Auth:** Required (JWT token, admin role)

**Path Parameters:**
- `inviteId` - Invitation ID

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Notes:**
- Only organization admins can resend invitations
- Sends new email notification via Clerk
- Extends expiration date by 7 days from current time

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Invalid request body",
  "details": "Slug must be lowercase alphanumeric with hyphens only"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions",
  "details": "Only organization admins can perform this action"
}
```

### 404 Not Found
```json
{
  "error": "Organization not found"
}
```

### 409 Conflict
```json
{
  "error": "Organization slug already exists"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "Failed to create organization in Clerk"
}
```

---

## Implementation Notes

### Clerk Integration

1. **Organization Creation:**
   - Use Clerk's Organizations API to create organization
   - Store Clerk org ID in MongoDB
   - Add creator as admin member in Clerk

2. **Invitations:**
   - Use Clerk's invitation system for email delivery
   - Store invitation metadata in MongoDB
   - Clerk handles email templates and delivery

3. **Membership:**
   - Sync membership between Clerk and MongoDB
   - Use Clerk for authentication and role checks
   - MongoDB for application-specific data

### Role-Based Access Control

- **Admin Role:**
  - Can send, revoke, and resend invitations
  - Can view all organization members
  - Can manage organization settings
  - Stored in Clerk public metadata: `{ role: 'admin', orgId: 'org_abc123' }`

- **Member Role:**
  - Can view organization details
  - Can view other members
  - Cannot manage invitations or settings

### Data Consistency

- Keep organization data synchronized between Clerk and MongoDB
- Use Clerk webhooks to handle membership changes
- Implement retry logic for failed Clerk API calls
- Store Clerk IDs in MongoDB for reference

### Security Considerations

1. Validate user is member before allowing access to org data
2. Verify admin role before allowing administrative actions
3. Check invitation email matches authenticated user's email
4. Validate invitation hasn't expired before accepting
5. Sanitize slug input to prevent injection attacks
6. Rate limit invitation sending to prevent spam

---

## Frontend Integration

The frontend uses the `kgSDK` service to interact with these endpoints. All requests include the Clerk JWT token in the Authorization header:

```typescript
Authorization: Bearer <clerk-jwt-token>
```

The SDK handles:
- Token retrieval from Clerk
- Request formatting
- Error handling
- Response parsing

See `src/services/kgSDK.ts` for implementation details.

---

## Testing Checklist

- [ ] Create organization with valid data
- [ ] Create organization with duplicate slug (should fail)
- [ ] List organizations for user with multiple orgs
- [ ] Get organization details as member
- [ ] Get organization details as non-member (should fail)
- [ ] List members as organization member
- [ ] Send invitation as admin
- [ ] Send invitation as non-admin (should fail)
- [ ] List invitations as admin
- [ ] List my invitations as invited user
- [ ] Accept invitation with matching email
- [ ] Accept invitation with non-matching email (should fail)
- [ ] Accept expired invitation (should fail)
- [ ] Decline invitation
- [ ] Revoke invitation as admin
- [ ] Revoke invitation as non-admin (should fail)
- [ ] Resend invitation as admin
- [ ] Verify Clerk organization is created
- [ ] Verify Clerk invitation is sent
- [ ] Verify user is added to Clerk org on accept
