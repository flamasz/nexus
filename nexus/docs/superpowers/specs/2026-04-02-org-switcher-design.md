# Organization Switcher Design

## Overview

Enable users to belong to multiple organizations and switch between them via a dropdown in the header.

## Database Changes

### New Table: `org_members`

```sql
CREATE TABLE org_members (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, organization_id)
);
```

- `role` field for future use (member/admin permissions per org)
- `users.organization_id` remains as the user's *active* organization

### Type Definitions

Add to `types/database.ts`:

```typescript
export interface OrgMember {
  user_id: string;
  organization_id: string;
  role: string;
  created_at: string;
}

export interface OrgMemberWithOrg extends OrgMember {
  organization: Organization;
}
```

## UI Changes

### Header Component

Transform the org pill from a static display to a `DropdownMenu`:

- **Trigger:** Current org pill (icon + name + chevron)
- **Content:**
  - Label: "Organizations"
  - List of user's orgs, each with org icon (first letter) and name
  - Current org shows checkmark icon
  - Clicking another org triggers switch

### Visual Design

Follows existing dark mode design system:
- Uses `DropdownMenu` component (same as user avatar menu)
- Org items show first-letter icon + org name
- Active org has `Check` icon on the right

## Server Actions

### `getUserOrganizations(userId: string)`

Location: `app/actions/organizations.ts`

Returns all organizations the user belongs to via `org_members` join.

### `switchOrganization(organizationId: string)`

Location: `app/actions/organizations.ts`

1. Verify user is member of target org
2. Update `users.organization_id` to new org
3. Redirect to `/dashboard`

## Data Flow

1. **Protected Layout:** Fetch user's orgs via `getUserOrganizations`
2. **Pass to AppShell:** `organizations` prop (array)
3. **Pass to Header:** `organizations` prop
4. **Header renders:** Dropdown with org list
5. **On switch:** Call `switchOrganization` server action

## Migration Strategy

For existing users:
- Create `org_members` entry for their current `organization_id`
- This ensures no data loss during transition

## Files to Modify

1. `src/types/database.ts` - Add types
2. `src/app/actions/organizations.ts` - New file with server actions
3. `src/app/(protected)/layout.tsx` - Fetch user's orgs
4. `src/components/layout/AppShell.tsx` - Pass orgs to Header
5. `src/components/layout/Header.tsx` - Implement dropdown

## Files to Create

1. Database migration for `org_members` table
