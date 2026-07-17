import type { ChangelogEntry } from '../changelog'

interface WhatsNewScreenProps {
  entries: ChangelogEntry[]
  onClose: () => void
}

export function WhatsNewScreen({ entries, onClose }: WhatsNewScreenProps) {
  const [latest, ...older] = entries

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="whatsnew-title">
      <div className="overlay__card whatsnew">
        <h2 id="whatsnew-title" className="overlay__title whatsnew__title">
          What's new
        </h2>

        <div className="whatsnew__scroll">
          <div className="whatsnew__entry whatsnew__entry--latest">
            <span className="whatsnew__version">v{latest.version}</span>
            <p className="whatsnew__entry-title">{latest.title}</p>
            <p className="whatsnew__entry-body">{latest.description}</p>
          </div>

          {older.length > 0 && (
            <div className="whatsnew__older">
              {older.map(entry => (
                <div key={entry.version} className="whatsnew__entry">
                  <span className="whatsnew__version whatsnew__version--muted">v{entry.version}</span>
                  <p className="whatsnew__entry-title">{entry.title}</p>
                  <p className="whatsnew__entry-body">{entry.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  )
}
