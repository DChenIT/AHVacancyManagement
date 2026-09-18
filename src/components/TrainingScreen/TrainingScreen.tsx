// SharePoint video embed. The embed.aspx address is built from the file's UniqueId (the GUID
// inside the share link's d=w... parameter) - a normal share link won't play inside an iframe.
// Viewers need read access to the SharePoint site, and the environment's Content Security
// Policy frame-src must include https://humangood.sharepoint.com (an admin-center setting,
// not part of the solution).
const TRAINING_VIDEO_EMBED_URL =
  'https://humangood.sharepoint.com/sites/AHCommunitiesAnalyst/_layouts/15/embed.aspx' +
  '?UniqueId=72b2de6b-f341-41f6-8327-ac89bb0e00b1' +
  '&embed=%7B%22ust%22%3Atrue%2C%22hv%22%3A%22CopyEmbedCode%22%7D' +
  '&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create';

const TRAINING_VIDEO_SHARE_URL =
  'https://humangood.sharepoint.com/:v:/r/sites/AHCommunitiesAnalyst/Shared%20Documents/Community%20Pulse%20Training%20Overview.mp4?d=w72b2de6bf34141f68327ac89bb0e00b1&csf=1&web=1&e=kzJTdj';

export function TrainingScreen() {
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%', maxWidth: 980 }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, marginTop: 0, marginBottom: 6 }}>Training</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 0, marginBottom: 16 }}>
        Community Pulse Training Overview — a walkthrough of how to enter and review reports.
      </p>

      <div style={{
        position: 'relative', width: '100%', paddingBottom: '56.25%', backgroundColor: '#000',
        borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)',
      }}>
        <iframe
          src={TRAINING_VIDEO_EMBED_URL}
          title="Community Pulse Training Overview"
          allow="fullscreen"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
        Video not loading?{' '}
        <a href={TRAINING_VIDEO_SHARE_URL} target="_blank" rel="noopener noreferrer">Open it in a new tab</a>.
      </p>
    </div>
  );
}
