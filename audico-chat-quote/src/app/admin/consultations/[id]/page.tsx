import { getSupabaseServer } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { ConsultationDetailView } from "@/components/admin/ConsultationDetailView";

interface Props {
  params: { id: string };
}

export default async function ConsultationDetailPage({ params }: Props) {
  const supabase = getSupabaseServer();

  // Authentication check
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/admin/consultations/${params.id}`);
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

  // Fetch consultation
  const { data: consultation, error } = await supabase
    .from("consultation_requests")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !consultation) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ConsultationDetailView consultation={consultation} />
    </div>
  );
}
