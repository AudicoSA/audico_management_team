# Authentication & Security Setup

## Overview

This document explains the authentication and authorization system implemented for the admin panel in Week 4. The system uses **Supabase Auth** with role-based access control (RBAC).

---

## Architecture

### Components

1. **Profiles Table** - Stores user roles and metadata
2. **Middleware** - Protects admin routes at the edge
3. **Auth Helpers** - Reusable authentication functions for API routes
4. **Login Page** - Simple email/password authentication
5. **Unauthorized Page** - Friendly access denial page

### User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `customer` | Regular customer (default) | No admin access |
| `specialist` | AV specialist/consultant | Read and manage consultations |
| `admin` | Admin user | Full admin panel access |
| `super_admin` | Super administrator | Full access + user management |

---

## Installation Steps

### Step 1: Run SQL Migration

**IMPORTANT**: Before running the migration, update the admin email address.

1. Open [006_user_profiles_and_roles.sql](./supabase/migrations/006_user_profiles_and_roles.sql)
2. Find this line (near the bottom):
   ```sql
   WHERE email = 'admin@audico.co.za' -- CHANGE THIS TO YOUR ADMIN EMAIL
   ```
3. Change `admin@audico.co.za` to your actual email address
4. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
5. Copy and paste the entire migration file
6. Click **Run** to execute

### Step 2: Create Your First Admin User

#### Option A: Sign up first, then run migration
1. Go to your app's sign-up page (if you have one) or use Supabase dashboard
2. Create a user with your email (e.g., `admin@audico.co.za`)
3. Run the migration (it will upgrade your account to `super_admin`)

#### Option B: Run migration first, then sign up
1. Run the migration with your email in the script
2. Sign up through Supabase dashboard or your app
3. The trigger will create a profile, then the INSERT statement will upgrade it to `super_admin`

**Manually create admin via Supabase Dashboard:**
```sql
-- After user signs up, you can manually set their role
UPDATE profiles
SET role = 'super_admin'::user_role, is_active = true
WHERE email = 'youremail@example.com';
```

### Step 3: Install Required Packages

```bash
npm install @supabase/auth-helpers-nextjs
```

### Step 4: Verify Environment Variables

Ensure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

---

## How It Works

### 1. Route Protection (Middleware)

**File**: [src/middleware.ts](./src/middleware.ts)

- Runs on every request to `/admin/*` routes
- Checks if user is authenticated
- Verifies user has admin role (`admin`, `specialist`, or `super_admin`)
- Redirects to `/login` if not authenticated
- Redirects to `/unauthorized` if not authorized

```typescript
// Automatic protection for all /admin routes
export const config = {
  matcher: ['/admin/:path*'],
};
```

### 2. API Route Protection

**File**: [src/lib/auth/auth-helpers.ts](./src/lib/auth/auth-helpers.ts)

All admin API routes use the `requireAdminAuth()` helper:

```typescript
import { requireAdminAuth } from '@/lib/auth/auth-helpers';

export async function GET(req: NextRequest) {
  // Check authentication
  const { error: authError } = await requireAdminAuth(req);
  if (authError) {
    return authError; // Returns 401 or 403 response
  }

  // Your protected logic here...
}
```

**Protected API Routes:**
- `GET /api/admin/consultations` - List consultations
- `GET /api/admin/consultations/[id]` - Get single consultation
- `PATCH /api/admin/consultations/[id]` - Update consultation

### 3. Server Component Protection

**Files**:
- [src/app/admin/consultations/page.tsx](./src/app/admin/consultations/page.tsx)
- [src/app/admin/consultations/[id]/page.tsx](./src/app/admin/consultations/[id]/page.tsx)

Server components check auth before rendering:

```typescript
export default async function AdminPage() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'specialist', 'super_admin'].includes(profile.role)) {
    redirect('/unauthorized');
  }

  // Render protected content...
}
```

---

## Login Flow

1. User navigates to `/admin/consultations`
2. Middleware detects no session → redirects to `/login?redirect=/admin/consultations`
3. User enters email and password
4. System checks credentials via Supabase Auth
5. System verifies user has admin role in `profiles` table
6. If authorized → redirect to originally requested page
7. If not authorized → show error message and sign out

---

## Row Level Security (RLS)

The `profiles` table has RLS policies:

### Policy: Users can view own profile
```sql
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);
```

### Policy: Admins can view all profiles
```sql
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
```

### Policy: Super admins can manage profiles
```sql
CREATE POLICY "Super admins can manage profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );
```

---

## Testing the Authentication

### Manual Testing Checklist

**1. Unauthenticated Access:**
- [ ] Navigate to `/admin/consultations` while logged out
- [ ] Should redirect to `/login`
- [ ] After login, should redirect back to `/admin/consultations`

**2. Non-Admin User:**
- [ ] Create a user with `customer` role
- [ ] Try to access `/admin/consultations`
- [ ] Should redirect to `/unauthorized`

**3. Admin User:**
- [ ] Create a user with `admin` role
- [ ] Navigate to `/admin/consultations`
- [ ] Should see consultation list
- [ ] Should be able to view consultation details
- [ ] Should be able to update status/priority

**4. API Protection:**
- [ ] Try `GET /api/admin/consultations` without auth
- [ ] Should return `401 Unauthorized`
- [ ] Try with valid admin token
- [ ] Should return consultation data

**5. Session Expiry:**
- [ ] Log in successfully
- [ ] Wait for session to expire (or manually delete cookies)
- [ ] Try to access admin page
- [ ] Should redirect to login

---

## Helper Functions

### Check if user is Super Admin

```typescript
import { isSuperAdmin } from '@/lib/auth/auth-helpers';

const { profile } = await requireAdminAuth(req);
if (isSuperAdmin(profile)) {
  // Super admin only logic
}
```

### Check if user can manage consultations

```typescript
import { canManageConsultations } from '@/lib/auth/auth-helpers';

if (canManageConsultations(profile)) {
  // Allow consultation management
}
```

---

## Adding New Admin Users

### Method 1: Via Supabase Dashboard

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Invite User" or have user sign up
3. Go to SQL Editor and run:
   ```sql
   UPDATE profiles
   SET role = 'admin'::user_role, is_active = true
   WHERE email = 'newadmin@example.com';
   ```

### Method 2: Via Admin UI (Future Enhancement)

Create an admin user management page (only accessible to `super_admin`):
- List all users
- Edit user roles
- Activate/deactivate users

---

## Security Best Practices

### ✅ What's Protected

1. **All admin routes** - Middleware protection
2. **All admin API endpoints** - Auth helper protection
3. **Role verification** - Both middleware and API check roles
4. **Active user check** - Inactive users are denied access
5. **RLS on profiles** - Database-level security

### ⚠️ Additional Recommendations

1. **Enable MFA** - Use Supabase MFA for admin accounts
2. **Audit Logging** - Log admin actions (future enhancement)
3. **Rate Limiting** - Add rate limiting to login endpoint
4. **Session Timeout** - Configure appropriate session duration
5. **IP Whitelisting** - Consider IP restrictions for admin routes (optional)

---

## Troubleshooting

### Issue: "Unauthorized" after login

**Possible causes:**
1. User doesn't have admin role in `profiles` table
2. User's `is_active` is `false`
3. Session cookie not being set

**Solution:**
```sql
-- Check user's profile
SELECT id, email, role, is_active
FROM profiles
WHERE email = 'your@email.com';

-- Update role if needed
UPDATE profiles
SET role = 'admin'::user_role, is_active = true
WHERE email = 'your@email.com';
```

### Issue: Middleware not working

**Possible causes:**
1. `@supabase/auth-helpers-nextjs` not installed
2. Middleware config not matching routes

**Solution:**
```bash
# Reinstall package
npm install @supabase/auth-helpers-nextjs

# Verify middleware.ts config
export const config = {
  matcher: ['/admin/:path*'],
};
```

### Issue: API returns 401 even when logged in

**Possible causes:**
1. Using client-side Supabase client instead of server-side
2. Service key not set in environment variables

**Solution:**
```typescript
// ❌ Wrong - uses anon key
import { supabaseClient } from '@/lib/supabase';

// ✅ Correct - uses service key
import { getSupabaseServer } from '@/lib/supabase';
const supabase = getSupabaseServer();
```

---

## Files Created/Modified

### New Files

1. `supabase/migrations/006_user_profiles_and_roles.sql` - Database schema
2. `src/middleware.ts` - Route protection
3. `src/app/login/page.tsx` - Login page
4. `src/app/unauthorized/page.tsx` - Unauthorized page
5. `src/lib/auth/auth-helpers.ts` - Auth utility functions
6. `AUTHENTICATION_SETUP.md` - This documentation

### Modified Files

1. `src/app/admin/consultations/page.tsx` - Added auth checks
2. `src/app/admin/consultations/[id]/page.tsx` - Added auth checks
3. `src/app/api/admin/consultations/route.ts` - Added auth checks
4. `src/app/api/admin/consultations/[id]/route.ts` - Added auth checks
5. `src/lib/supabase.ts` - Added profiles table types

---

## Next Steps

After implementing authentication, consider:

1. **Email Notifications** (Week 4, Part B)
   - Send email when admin assigns consultation
   - Send email when status changes

2. **User Management UI** (Future)
   - Admin page to manage user roles
   - Invite new admin users
   - Deactivate/reactivate users

3. **Audit Logging** (Future)
   - Log all admin actions
   - Track who updated what consultation

4. **MFA** (Future)
   - Enable Supabase MFA for admin accounts
   - Require MFA for super_admin role

---

## Support

If you encounter issues:
1. Check Supabase logs in dashboard
2. Check browser console for errors
3. Verify environment variables are set
4. Check `profiles` table has correct roles
5. Review this documentation

For questions, contact the development team or refer to:
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Next.js Middleware Docs](https://nextjs.org/docs/app/building-your-application/routing/middleware)
