/* ================================================================== */
/* FutureBug — BugReportCard                                          */
/* Single ticket card: what breaks, and the code that fixes it.       */
/* ================================================================== */

import { formatLines } from '../mockData.js'
import { SparkIcon } from './icons.jsx'

export default function BugReportCard({ result, tone }) {
  return (
    <article className={`bug-card bug-card--${tone}`}>
      <div className="bug-card__top">
        <span className="bug-card__ticket">{result.ticket}</span>
        <span className="bug-card__state">
          <SparkIcon size={12} />
          {result.classification === 'confirmed' ? 'Confirmed' : 'Possible risk'}
        </span>
      </div>

      <h2 className="bug-card__title" title={result.title}>
        {result.title}
      </h2>

      <p className="bug-card__desc">{result.description}</p>

      {result.evidence ? <p className="bug-card__fix-note"><strong>Evidence:</strong> {result.evidence}</p> : null}

      {result.recommendation ? (
        <p className="bug-card__fix-note">{result.recommendation}</p>
      ) : null}

      {result.suggested_fix ? (
        <div className="bug-card__fix">
          <span className="bug-card__fix-label">Suggested fix</span>
          <pre className="bug-card__fix-code">
            <code>{result.suggested_fix}</code>
          </pre>
        </div>
      ) : null}

      <div className="bug-card__foot">
        <span className="bug-card__lines">
          {'Related to lines '}
          <span className="line-pill">{formatLines(result.lines)}</span>
        </span>
      </div>
    </article>
  )
}
