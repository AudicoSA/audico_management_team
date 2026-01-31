import { getSupabaseServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { ConsultationListTable } from "@/components/admin/ConsultationListTable";

export default async function ConsultationsPage() {
  const supabase = getSupabaseServer();

  // Authentication check
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin/consultations');
  }

  // Check if user has admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'specialist', 'super_admin'].includes(profile.role) || !profile.is_active) {
    redirect('/unauthorized');
  }

  // Fetch initial data
  const { data: consultations } = await supabase
    .from("consultation_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Consultation Requests
        </h1>
        <p className="text-gray-600 mt-2">
          Manage complex audio project requests
        </p>
      </div>

      <ConsultationListTable initialData={consultations || []} />
    </div>
  );
}
