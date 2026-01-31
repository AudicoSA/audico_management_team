import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

/**
 * Authentication helper for API routes
 * Checks if user is authenticated and has admin privileges
 */
export async function requireAdminAuth(req: NextRequest): Promise<{
  user: any;
  profile: any;
  error?: NextResponse;
}> {
  const supabase = getSupabaseServer();

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      profile: null,
      error: NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      ),
    };
  }

  // Check if user has admin role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active, full_name, email')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      user,
      profile: null,
      error: NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      ),
    };
  }

  // Check if user has admin privileges and is active
  if (!['admin', 'specialist', 'super_admin'].includes(profile.role)) {
    return {
      user,
      profile,
      error: NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      ),
    };
  }

  if (!profile.is_active) {
    return {
      user,
      profile,
      error: NextResponse.json(
        { error: 'Account is inactive' },
        { status: 403 }
      ),
    };
  }

  // Success - user is authenticated and authorized
  return { user, profile };
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(profile: any): boolean {
  return profile?.role === 'super_admin' && profile?.is_active === true;
}

/**
 * Check if user can manage consultations
 */
export function canManageConsultations(profile: any): boolean {
  return (
    profile?.is_active === true &&
    ['admin', 'specialist', 'super_admin'].includes(profile?.role)
  );
}
