export function FeedbackPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Feedback</h1>
        <p>Congrats, you are chosen to view this page.</p>
      </div>
      <article className="panel">
        <p>
          This is a phased rollout page. Access is controlled by a PostHog feature flag so only selected users can open it.
        </p>
      </article>
    </div>
  );
}
