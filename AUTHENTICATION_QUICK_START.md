# 🚀 Authentication Quick Start Guide

## Step-by-Step Installation

### Step 1: Update Admin Email in SQL Migration

1. Open file: `audico-chat-quote/supabase/migrations/006_user_profiles_and_roles.sql`
2. Find line 105 (near bottom of file)
3. Change `'admin@audico.co.za'` to **YOUR EMAIL ADDRESS**:
   ```sql
   WHERE email = 'YOUR_EMAIL@example.com' -- CHANGE THIS!
   ```

### Step 2: Run SQL Migration in Supabase

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy the **ENTIRE contents** of `006_user_profiles_and_roles.sql`
3. Paste into SQL Editor
4. Click **Run** (or press `Ctrl+Enter`)
5. Wait for "Success" message

### Step 3: Install Required NPM Package

```bash
cd audico-chat-quote
npm install @supabase/auth-helpers-nextjs
```

### Step 4: Verify Environment Variables

Check `.env.local` has these variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...  # IMPORTANT: Service role key, not anon key
```

### Step 5: Create Your Admin Account

#### Option A: If you already have an account
Run this in Supabase SQL Editor:
```sql
UPDATE profiles
SET role = 'super_admin'::user_role, is_active = true
WHERE email = 'YOUR_EMAIL@example.com';
```

#### Option B: If you need to create an account
1. Use Supabase Dashboard → Authentication → Users → "Invite User"
2. Enter your email and temporary password
3. The migration automatically created your profile with super_admin role

### Step 6: Test the Authentication

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Navigate to: http://localhost:3000/admin/consultations

3. You should be redirected to: http://localhost:3000/login

4. Login with your admin email and password

5. You should be redirected back to the consultations page ✅

---

## Quick SQL Commands

### Check your profile:
```sql
SELECT id, email, role, is_active
FROM profiles
WHERE email = 'YOUR_EMAIL@example.com';
```

### Make someone an admin:
```sql
UPDATE profiles
SET role = 'admin'::user_role, is_active = true
WHERE email = 'user@example.com';
```

### Make someone a specialist:
```sql
UPDATE profiles
SET role = 'specialist'::user_role, is_active = true
WHERE email = 'specialist@example.com';
```

### Deactivate a user:
```sql
UPDATE profiles
SET is_active = false
WHERE email = 'user@example.com';
```

### List all admin users:
```sql
SELECT email, role, is_active, created_at
FROM profiles
WHERE role IN ('admin', 'specialist', 'super_admin')
ORDER BY created_at DESC;
```

---

## Troubleshooting

### ❌ "Cannot find module '@supabase/auth-helpers-nextjs'"
**Solution:**
```bash
npm install @supabase/auth-helpers-nextjs
```

### ❌ Login shows "Unauthorized" error
**Solution:** Check your role in database:
```sql
SELECT email, role, is_active FROM profiles WHERE email = 'YOUR_EMAIL';
```

If role is wrong, update it:
```sql
UPDATE profiles SET role = 'super_admin'::user_role WHERE email = 'YOUR_EMAIL';
```

### ❌ Redirected to /unauthorized after login
**Solution:** Your account might be inactive:
```sql
UPDATE profiles SET is_active = true WHERE email = 'YOUR_EMAIL';
```

### ❌ Profile doesn't exist
**Solution:** Create profile manually:
```sql
INSERT INTO profiles (id, email, role, is_active)
SELECT id, email, 'super_admin'::user_role, true
FROM auth.users
WHERE email = 'YOUR_EMAIL';
```

---

## Testing Checklist

- [ ] Migration ran successfully (no errors)
- [ ] Package installed: `@supabase/auth-helpers-nextjs`
- [ ] Can access `/admin/consultations` and get redirected to `/login`
- [ ] Can login with admin credentials
- [ ] After login, redirected back to admin panel
- [ ] Can see consultation list
- [ ] Can click on a consultation and see details
- [ ] API calls work (check Network tab in DevTools)

---

## What Was Implemented

✅ **Profiles Table** - Stores user roles (customer, admin, specialist, super_admin)
✅ **Middleware** - Protects all `/admin/*` routes automatically
✅ **Login Page** - Simple email/password authentication at `/login`
✅ **API Protection** - All admin API endpoints require authentication
✅ **Auth Helpers** - Reusable functions for checking admin access
✅ **TypeScript Types** - Full type safety for profiles table
✅ **RLS Policies** - Database-level security with Row Level Security

---

## Next Steps

After authentication works:
1. ✅ Test with multiple users (admin, specialist, customer)
2. 📧 Move to Week 4, Part B: Email Notifications
3. 🧪 Move to Week 4, Part C: Testing & Quality Assurance

---

## Need Help?

Read the full documentation: [AUTHENTICATION_SETUP.md](./audico-chat-quote/AUTHENTICATION_SETUP.md)
