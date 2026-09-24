// Shown on the report preview right after someone submits a NEW report. A plain link the person
// clicks (rather than a window opened automatically) because browsers block pop-ups that open
// after an async save, and this way it always works.
const SURVEY_URL = 'https://forms.cloud.microsoft/r/vq6GXuZD0T';

export function SurveyPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="status" style={{
      backgroundColor: 'var(--success-bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, flexShrink: 0,
    }}>
      <span style={{ color: 'var(--success)', fontSize: 16, fontWeight: 700 }}>✅ Report submitted.</span>
      <span style={{ color: 'var(--text-primary)', fontSize: 15 }}>Please take a moment to complete a quick survey.</span>
      <a
        href={SURVEY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onDismiss}
        style={{
          backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', borderRadius: 8, padding: '8px 18px',
          fontSize: 15, fontWeight: 700, textDecoration: 'none',
        }}
      >Open the survey</a>
      <button
        onClick={onDismiss}
        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
      >Dismiss</button>
    </div>
  );
}
