import { LANGUAGES } from '../mockData.js'
import { BugIcon } from './icons.jsx'

export default function LoadingScreen({ code, language, progress, onCancel }) {
  const lineCount = code ? code.split('\n').length : 0
  const lang = LANGUAGES[language] ?? LANGUAGES.python
  const percentage = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <section className="screen screen--loading" aria-labelledby="loading-title" aria-busy="true">
      <div className="loader" aria-hidden="true"><span className="loader__ring" /><span className="loader__core"><BugIcon size={22} /></span></div>
      <h1 className="loading__title" id="loading-title">Analyzing your code...</h1>
      <p className="loading__sub">Reading {lineCount} lines of {lang.label} for smells, complexity and duplicated logic.</p>
      {progress.total > 1 && <p className="loading__progress" aria-live="polite">Analyzing {progress.current} of {progress.total} · {progress.completed} completed</p>}
      <div className="loading__bar" role="progressbar" aria-label="Batch analysis progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage}><span style={{ width: `${percentage}%` }} /></div>
      <p className="loading__steps">checking patterns <i>·</i> locating findings <i>·</i> preparing report</p>
      <button type="button" className="btn btn--secondary loading__cancel" onClick={onCancel}>Cancel batch</button>
    </section>
  )
}
