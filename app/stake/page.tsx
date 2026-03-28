import StakingComingSoon from "@/components/StakingComingSoon";

// Server Component - can be prerendered
export default async function StakePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // Await the searchParams
  const { ref } = await searchParams;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <StakingComingSoon />
    </div>
  );
}
