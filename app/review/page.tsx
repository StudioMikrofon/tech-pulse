import ReviewPanel from "./ReviewPanel";

export const metadata = {
  title: "Review Panel | TECH & SPACE",
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  if (process.env.NEXT_PUBLIC_AGENT_PANEL !== "true") {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center font-mono text-text-secondary">
        // Access denied
      </div>
    );
  }

  return <ReviewPanel />;
}
