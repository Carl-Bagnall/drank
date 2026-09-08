import { usePageTitle } from "../usePageTitle";
import { Link } from "react-router";
import { EmptyState } from "../components/States";

export function NotFound() {
  usePageTitle("Page not found");
  return (
    <EmptyState
      icon="🫙"
      tone="bg-tang"
      title="Page not found"
      description="That page does not exist. It may have been moved."
      action={
        <Link to="/" className="btn btn-cherry">
          Back to home
        </Link>
      }
    />
  );
}
