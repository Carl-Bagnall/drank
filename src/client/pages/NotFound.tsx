import { Link } from "react-router";
import { EmptyState } from "../components/States";

export function NotFound() {
  return (
    <EmptyState
      icon="🫙"
      title="Page not found"
      description="That page does not exist. It may have been moved."
      action={
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-pill bg-cherry px-5 text-sm font-semibold text-white"
        >
          Back to home
        </Link>
      }
    />
  );
}
