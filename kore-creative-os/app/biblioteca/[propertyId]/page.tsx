import { ProjectScreen } from "./project";

export default async function LibraryProjectPage({
  params,
}: {
  params: Promise<{
    propertyId: string;
  }>;
}) {
  const { propertyId } = await params;

  return <ProjectScreen propertyId={propertyId} />;
}