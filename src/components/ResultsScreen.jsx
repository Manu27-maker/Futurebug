import { useEffect, useMemo, useRef, useState } from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php'
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby'
import dart from 'react-syntax-highlighter/dist/esm/languages/prism/dart'
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus'
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light'
import { LANGUAGES, TONES, formatLines } from '../mockData.js'
import BugReportCard from './BugReportCard.jsx'
import { CheckIcon, CopyIcon, ResetIcon } from './icons.jsx'

const grammars = { python, javascript, java, typescript, c, cpp, go, rust, php, ruby, dart }
const EMPTY_RESULTS = []
Object.entries(grammars).forEach(([name, grammar]) => SyntaxHighlighter.registerLanguage(name, grammar))

function fullReport(analyses) {
  const lines = ['# FutureBug Analysis Report', '', `Files analyzed: ${analyses.length}`, '']
  analyses.forEach((item) => {
    const lang = LANGUAGES[item.language]?.label || item.language
    lines.push(`## ${item.name} (${lang})`, '')
    if (item.error) {
      lines.push(`**Analysis failed:** ${item.error}`, '')
      return
    }
    if (item.diagnostics?.length) {
      lines.push('### Parser diagnostics (confirmed parser observations)', '')
      item.diagnostics.forEach((diagnostic) => lines.push(`- Line ${diagnostic.line}: ${diagnostic.message} (${diagnostic.source}; parser output is not a compiler/type-check result)`))
      lines.push('')
    }
    if (item.cancelled) lines.push(`**Canceled:** ${item.cancelMessage || 'This file was not analyzed.'}`, '')
    if (!item.results.length) {
      if (!item.diagnostics?.length && !item.cancelled) lines.push('No possible-risk findings were detected.', '')
      return
    }
    item.results.forEach((result) => {
      lines.push(`### ${result.ticket}: ${result.title}`, '')
      lines.push(`- Severity: ${result.severity || 'unspecified'}`)
      lines.push(`- Classification: ${result.classification === 'confirmed' ? 'Confirmed finding' : 'Possible risk (review required)'}`)
      lines.push(`- Lines: ${formatLines(result.lines)}`)
      if (result.evidence) lines.push(`- Evidence: ${result.evidence}`)
      if (result.description) lines.push('', result.description)
      if (result.future_scenario) lines.push('', `**Possible future scenario:** ${result.future_scenario}`)
      if (result.impact) lines.push('', `**Potential impact:** ${result.impact}`)
      if (result.recommendation) lines.push('', `**Recommendation:** ${result.recommendation}`)
      if (result.suggested_fix) lines.push('', '```', result.suggested_fix, '```')
      lines.push('')
    })
  })
  return `${lines.join('\n')}\n`
}

export default function ResultsScreen({ analyses, theme, onReset, onReplaceSource, cancelled }) {
  const [selected, setSelected] = useState(0)
  const [proposalDecisions, setProposalDecisions] = useState({})
  const [copied, setCopied] = useState(false)
  const [reportCopied, setReportCopied] = useState(false)
  const headingRef = useRef(null)
  const timerRef = useRef(null)
  const active = analyses[selected] || analyses[0]
  const results = active?.results || EMPTY_RESULTS
  const language = active?.language || 'python'
  const code = active?.code || ''
  const proposalAccepted = proposalDecisions[selected] === 'applied'
  const displayedCode = proposalAccepted && active?.improvedCode ? active.improvedCode : code
  const lang = LANGUAGES[language] || LANGUAGES.python
  const lineCount = code ? code.split('\n').length : 0
  const allIssueCount = analyses.reduce((sum, item) => sum + (item.results?.length || 0), 0)
  const flaggedCount = useMemo(() => new Set(results.flatMap((item) => item.lines || [])).size, [results])

  useEffect(() => { headingRef.current?.focus() }, [])
  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const toneByLine = useMemo(() => {
    const map = new Map()
    results.forEach((result, index) => (result.lines || []).forEach((line) => {
      if (!map.has(line)) map.set(line, TONES[index % TONES.length])
    }))
    return map
  }, [results])

  function lineProps(lineNumber) {
    const tone = toneByLine.get(lineNumber)
    return { className: tone ? `code-line code-line--${tone}` : 'code-line' }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(displayedCode)
      setCopied(true)
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setCopied(false), 1800)
    } catch { /* Clipboard permission may be denied. */ }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(fullReport(analyses))
      setReportCopied(true)
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setReportCopied(false), 1800)
    } catch {
      window.alert('Could not copy the report. Use Export full report instead.')
    }
  }

  function exportReport() {
    const blob = new Blob([fullReport(analyses)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'futurebug-report.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportImprovedCode() {
    if (!active?.improvedCode) return
    const originalName = (active.name || lang.file).split(/[\\/]/).pop()
    const dot = originalName.lastIndexOf('.')
    const downloadName = dot > 0
      ? `${originalName.slice(0, dot)}.improved${originalName.slice(dot)}`
      : `${originalName}.improved`
    const blob = new Blob([active.improvedCode], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = downloadName.replace(/[<>:"|?*]/g, '_')
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (!active) return null

  return (
    <section className="screen screen--results" aria-labelledby="results-title">
      <header className="results__head">
        <div className="results__intro">
          <span className="eyebrow eyebrow--success"><span className="eyebrow__dot" aria-hidden="true" />{cancelled ? 'Batch canceled · partial results' : 'Analysis complete'} · {analyses.length} file{analyses.length === 1 ? '' : 's'}</span>
          <h1 className="results__title" id="results-title" tabIndex={-1} ref={headingRef}>{allIssueCount} {allIssueCount === 1 ? 'issue' : 'issues'} across {analyses.length} file{analyses.length === 1 ? '' : 's'}</h1>
          <p className="results__sub">Viewing {active.name} · {lineCount} lines of {lang.label}{cancelled ? ' · files not reached before cancellation are marked' : ''}</p>
        </div>
        <div className="stats"><div className="stat"><span className="stat__value">{String(allIssueCount).padStart(2, '0')}</span><span className="stat__label">Total issues</span></div><div className="stat"><span className="stat__value stat__value--warn">{String(flaggedCount).padStart(2, '0')}</span><span className="stat__label">Flagged lines</span></div></div>
      </header>

      {analyses.length > 1 && <nav className="analysis-tabs" aria-label="Analyzed files">
        {analyses.map((item, index) => <button type="button" key={`${item.name}-${index}`} className={`analysis-tabs__item${selected === index ? ' is-active' : ''}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.name}{item.cancelled ? ' · not analyzed' : item.error ? ' · error' : ` · ${item.results.length}`}</button>)}
      </nav>}

      {active.error ? <div className="analysis-error" role="alert"><strong>Could not analyze {active.name}.</strong><p>{active.error}</p><p>Check that the backend is running, the file is valid for the selected language, and any configured external service is reachable. Other files in this batch may still have completed successfully.</p></div> : active.cancelled ? <div className="analysis-error" role="status"><strong>{active.name} was not completed.</strong><p>{active.cancelMessage}</p></div> : <>
        {active.diagnostics?.length > 0 && <section className="parser-diagnostics" aria-label="Parser diagnostics"><h2>Parser diagnostics</h2><p>Confirmed observations from the parser, not compiler or type-check results.</p><ul>{active.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.line}-${index}`}>Line {diagnostic.line}, column {diagnostic.column}: {diagnostic.message} <small>({diagnostic.source}: {diagnostic.node})</small></li>)}</ul></section>}
        {active.improvedCode ? <section className="improvement-panel" aria-labelledby="improvement-title">
          <div className="improvement-panel__heading"><div><span className="eyebrow">Suggested improvement</span><h2 id="improvement-title">Review the proposed code</h2></div><button type="button" className="btn btn--secondary" onClick={exportImprovedCode}>Export improved code</button></div>
          <p className="improvement-panel__summary">{active.improvementSummary || 'A conservative code improvement is proposed based on the findings.'}</p>
          <p className="improvement-panel__notice">AI-generated proposal · syntax-checked with the available parser, but not tested or applied to your original file. Review behavior before using it.</p>
          <div className="improvement-panel__code-grid">
            <div><h3>Original code</h3><pre><code>{code}</code></pre></div>
            <div><h3>Proposed improved code</h3><pre><code>{active.improvedCode}</code></pre></div>
          </div>
          <div className="improvement-panel__decision"><strong>How would you like to use this proposal?</strong>
            <div className="improvement-panel__actions"><button type="button" className="btn btn--primary" onClick={() => setProposalDecisions((current) => ({ ...current, [selected]: 'applied' }))}>{proposalAccepted ? 'Applied to preview' : 'Use in preview only'}</button><button type="button" className="btn btn--secondary" onClick={() => onReplaceSource(selected, active.improvedCode)}>Replace current source</button><button type="button" className="btn btn--secondary" onClick={() => setProposalDecisions((current) => ({ ...current, [selected]: 'kept' }))}>Keep original code</button></div>
          </div>
          <p className="improvement-panel__replace-note">Replacing returns to the input screen and updates FutureBug&apos;s in-memory source for the next analysis. It never overwrites the original file on disk.</p>
          {proposalDecisions[selected] === 'applied' && <p className="improvement-panel__choice" role="status">Proposal applied to this review preview only. Your original uploaded/pasted file is unchanged; export the improved code to save a separate copy.</p>}
          {proposalDecisions[selected] === 'kept' && <p className="improvement-panel__choice" role="status">Original code kept. The proposed version remains available to review or export.</p>}
        </section> : active.improvementMessage ? <section className="improvement-panel" aria-labelledby="improvement-title"><h2 id="improvement-title">Code improvement proposal unavailable</h2><p>{active.improvementMessage}</p></section> : null}
        <div className="code-card">
          <div className="code-card__head"><span className="window-dots" aria-hidden="true"><i /><i /><i /></span><span className="code-card__file">{active.name || lang.file}{proposalAccepted ? ' · improved preview' : ''}</span><span className="chip chip--language"><i style={{ background: lang.dot }} aria-hidden="true" />{lang.label}</span><button type="button" className="icon-btn" onClick={copyCode} aria-label={proposalAccepted ? 'Copy improved preview code' : 'Copy source code'}>{copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}<span>Copy code</span></button></div>
          <div className="code-scroll"><SyntaxHighlighter language={language} style={theme === 'dark' ? vscDarkPlus : oneLight} showLineNumbers wrapLines lineProps={proposalAccepted ? undefined : lineProps} lineNumberStyle={{ minWidth: '2.75em', paddingRight: '1.15em', textAlign: 'right', color: 'var(--code-line-number)', userSelect: 'none' }} customStyle={{ margin: 0, padding: '14px 0', background: 'transparent', fontFamily: 'var(--font-mono)', fontSize: '13.5px', lineHeight: 1.7 }} codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}>{displayedCode || '// no code was analyzed'}</SyntaxHighlighter></div>
          <div className="code-card__legend">{results.map((result, index) => <span className="legend-item" key={result.ticket}><i className={`legend-swatch legend-swatch--${TONES[index % TONES.length]}`} aria-hidden="true" />{result.ticket}</span>)}<span className="legend-note">{proposalAccepted ? 'Finding line references refer to the original source' : 'Highlighted lines map to possible-risk findings'}</span></div>
        </div>
        {results.length ? <div className="report-list" aria-label="Possible-risk findings">{results.map((result, index) => <BugReportCard key={result.ticket} result={result} tone={TONES[index % TONES.length]} />)}</div> : !active.diagnostics?.length && <p className="empty-results">No possible-risk findings were detected in this file.</p>}
      </>}

      <div className="results__actions">
        <button type="button" className="btn btn--primary" onClick={onReset}><ResetIcon size={16} />Analyze More Code</button>
        <button type="button" className="btn btn--secondary" onClick={copyReport}>{reportCopied ? 'Copied report' : 'Copy full report'}</button>
        <button type="button" className="btn btn--secondary" onClick={exportReport}>Export full report (.md)</button>
      </div>
      <p className="results__footnote">Full report actions include every analyzed file, including file-specific errors.</p>
    </section>
  )
}
