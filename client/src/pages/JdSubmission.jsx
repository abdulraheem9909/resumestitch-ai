import { useParams } from "react-router-dom";
import PlaceholderPage from "../components/PlaceholderPage.jsx";

export default function JdSubmission() {
  const { resumeId } = useParams();

  return (
    <>
      <PlaceholderPage
        eyebrow="New application"
        title="Paste a job description"
        description="This is where you'll paste a job's text, company name, and an optional reference link to start tailoring against the resume you selected. Not built yet — routing only, per the build order in the workflow doc."
      />
      <p className="mt-4 font-mono text-xs text-muted-foreground">resumeId: {resumeId}</p>
    </>
  );
}
