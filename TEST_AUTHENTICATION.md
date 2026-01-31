# 🧪 Test Authentication - Quick Guide

## ✅ Pre-Test Checklist

- [x] SQL migration executed successfully
- [x] `@supabase/ssr` package installed
- [x] Environment variables configured
- [ ] **Admin account verified in database** ⬅️ **DO THIS NOW**

---

## Step 1: Verify Admin Account Exists

### Go to Supabase SQL Editor
**URL**: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto/sql

### Run this query:
```sql
SELECT
  email,
  role,
  is_active,
  created_at
FROM profiles
WHERE email = 'admin@audico.co.za';
```

### Expected Result:
```
email                | role         | is_active | created_at
---------------------|--------------|-----------|------------
admin@audico.co.za   | super_admin  | true      | 2026-01-27...
```

### If No Results (Admin doesn't exist):

**Option A**: Create account through Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto/auth/users
2. Click "Invite User"
3. Email: `admin@audico.co.za`
4. Set temporary password
5. Then run:
   ```sql
   UPDATE profiles
   SET role = 'super_admin'::user_role, is_active = true
   WHERE email = 'admin@audico.co.za';
   ```

**Option B**: Use existing auth.users
If you already have a user in `auth.users` table:
```sql
-- Check existing users
SELECT id, email FROM auth.users;

-- Create profile for existing user
INSERT INTO profiles (id, email, role, is_active)
SELECT id, email, 'super_admin'::user_role, true
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com'
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin'::user_role, is_active = true;
```

---

## Step 2: Start Dev Server

```bash
cd audico-chat-quote
npm run dev
```

Wait for: `✓ Ready in X.XXs`

---

## Step 3: Test Authentication Flow

### Test 1: Redirect to Login
1. Open: http://localhost:3000/admin/consultations
2. ✅ **Should redirect to**: `/login?redirect=/admin/consultations`

### Test 2: Login
1. Enter email: `admin@audico.co.za` (or your admin email)
2. Enter password
3. Click "Sign in"
4. ✅ **Should redirect to**: `/admin/consultations`
5. ✅ **Should see**: Consultation list with stats cards

### Test 3: View Consultation Detail
1. Click on any reference code (e.g., CQ-20260126-001)
2. ✅ **Should navigate to**: `/admin/consultations/[id]`
3. ✅ **Should see**: Full consultation details

### Test 4: API Authentication
1. Open DevTools (F12) → Network tab
2. Refresh the consultations page
3. Find request to: `/api/admin/consultations`
4. ✅ **Status should be**: 200 OK
5. ✅ **Response should contain**: Array of consultations

### Test 5: Session Persistence
1. Close browser completely
2. Reopen browser
3. Navigate to: http://localhost:3000/admin/consultations
4. ✅ **Should NOT redirect to login** (still logged in)

### Test 6: Logout (Manual)
1. Open DevTools → Application → Cookies
2. Delete all cookies starting with `sb-`
3. Refresh page
4. ✅ **Should redirect to**: `/login`

---

## Step 4: Test Non-Admin Access

### Create Test Customer User
```sql
-- In Supabase SQL Editor
INSERT INTO profiles (id, email, role, is_active)
SELECT id, email, 'customer'::user_role, true
FROM auth.users
WHERE email = 'test@example.com';
```

### Try to Access Admin Panel
1. Logout current session (delete cookies)
2. Try to login as customer user
3. ✅ **Should see error**: "You do not have permission to access the admin panel"
4. ✅ **Should be signed out automatically**

---

## Step 5: Test API Protection

### Open Browser Console (F12 → Console)

### Test Authenticated API Call
```javascript
// Should succeed if logged in as admin
fetch('/api/admin/consultations')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

✅ **Expected**: Returns consultation data

### Test Unauthenticated API Call
```javascript
// First, clear all cookies to simulate unauthenticated request
// Then run:
fetch('/api/admin/consultations')
  .then(r => r.json())
  .then(console.log);
```

✅ **Expected**: Returns `{ error: "Unauthorized - Please log in" }` with 401 status

---

## Common Issues & Solutions

### ❌ "User does not exist"
**Problem**: Admin account not created
**Solution**: Follow Step 1 above to create admin account

### ❌ "You do not have permission"
**Problem**: User exists but doesn't have admin role
**Solution**:
```sql
UPDATE profiles
SET role = 'admin'::user_role, is_active = true
WHERE email = 'your@email.com';
```

### ❌ Page keeps redirecting to /login in loop
**Problem**: Middleware or auth check failing
**Solution**:
1. Check browser console for errors
2. Verify environment variables are set
3. Restart dev server: `Ctrl+C` then `npm run dev`

### ❌ API returns empty array even when consultations exist
**Problem**: Using wrong Supabase client or RLS blocking access
**Solution**: Admin APIs use service key which bypasses RLS, should work fine

### ❌ "Cannot find module '@supabase/ssr'"
**Problem**: Package not installed
**Solution**: `npm install @supabase/ssr`

---

## Success Indicators ✅

All these should work:
- [ ] Unauthenticated users redirected to /login
- [ ] Admin users can login successfully
- [ ] After login, can see consultation list
- [ ] Can click and view consultation details
- [ ] API calls return data (check Network tab)
- [ ] Session persists across browser restarts
- [ ] Non-admin users cannot access admin panel
- [ ] Manual logout (clear cookies) redirects to login

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Move to Week 4, Part B: Email Notifications
2. Review [WEEK_4_HANDOVER.md](./WEEK_4_HANDOVER.md) for Part B details

### If Tests Fail ❌
1. Check error messages in browser console
2. Check Supabase logs in dashboard
3. Review [AUTHENTICATION_SETUP.md](./audico-chat-quote/AUTHENTICATION_SETUP.md)
4. Verify SQL migration ran successfully
5. Verify admin account exists with correct role

---

## Quick SQL Helpers

### List all users with their roles:
```sql
SELECT
  p.email,
  p.role,
  p.is_active,
  p.created_at,
  u.created_at as auth_created
FROM profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;
```

### Check authentication status in DB:
```sql
SELECT
  email,
  role,
  is_active,
  CASE
    WHEN role IN ('admin', 'specialist', 'super_admin') AND is_active = true
    THEN 'CAN ACCESS ADMIN'
    ELSE 'CANNOT ACCESS ADMIN'
  END as admin_access
FROM profiles
ORDER BY created_at DESC;
```

### Create additional admin:
```sql
UPDATE profiles
SET role = 'admin'::user_role, is_active = true
WHERE email = 'newadmin@example.com';
```

---

## Support

Questions? Check:
- [AUTHENTICATION_QUICK_START.md](./AUTHENTICATION_QUICK_START.md)
- [AUTHENTICATION_SETUP.md](./audico-chat-quote/AUTHENTICATION_SETUP.md)
- [WEEK_4_PART_A_COMPLETE.md](./WEEK_4_PART_A_COMPLETE.md)

**Ready to test!** 🚀
