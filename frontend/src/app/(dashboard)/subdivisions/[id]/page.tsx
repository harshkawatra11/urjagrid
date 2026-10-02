import { SubdivisionDetailView } from "./SubdivisionDetailView";

export default async function SubdivisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubdivisionDetailView id={id} />;
}
