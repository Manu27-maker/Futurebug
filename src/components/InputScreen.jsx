import { useRef, useState } from 'react'
import { detectLanguageFromCode, languageForFile, LANGUAGES, MAX_SOURCE_BYTES, SAMPLES } from '../mockData.js'
import { AlertIcon, ArrowRightIcon, ChevronDownIcon } from './icons.jsx'

const ACCEPTED = '.py,.pyw,.js,.mjs,.cjs,.jsx,.java,.ts,.tsx,.c,.h,.cc,.cpp,.cxx,.hpp,.hxx,.go,.rs,.php,.rb,.dart'
const MAX_BATCH_FILES = 20
const MAX_BATCH_BYTES = 2 * 1024 * 1024

export default function InputScreen({ language, onLanguageChange, code, onCodeChange, onAnalyze, files, onFilesChange, replacementNotice }) {
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef(null)

  const lineCount = code ? code.split('\n').length : 0

  async function addFiles(fileList) {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return
    const loaded = []
    const problems = []
    let totalBytes = files.reduce((sum, file) => sum + new Blob([file.code]).size, 0)
    let acceptedCount = files.length
    for (const file of incoming) {
      const detectedLanguage = languageForFile(file.name)
      if (!detectedLanguage) continue
      const displayName = file.webkitRelativePath || file.name
      if (acceptedCount >= MAX_BATCH_FILES) {
        problems.push(`Limit is ${MAX_BATCH_FILES} supported files per batch`)
        break
      }
      if (file.size > MAX_SOURCE_BYTES) {
        problems.push(`${displayName}: larger than 200 KB`)
        continue
      }
      if (totalBytes + file.size > MAX_BATCH_BYTES) {
        problems.push(`Batch size limit is 2 MB; skipped ${displayName} and remaining files`)
        break
      }
      try {
        const text = await file.text()
        if (!text.trim()) problems.push(`${displayName}: file is empty`)
        else {
          loaded.push({ name: displayName, code: text, language: detectedLanguage })
          totalBytes += file.size
          acceptedCount += 1
        }
      } catch {
        problems.push(`${displayName}: could not be read`)
      }
    }
    if (loaded.length) {
      onFilesChange([...files, ...loaded])
      if (!files.length) {
        onCodeChange(loaded[0].code)
        onLanguageChange(loaded[0].language)
      }
    }
    setError(problems.length ? problems.join('. ') : '')
  }

  function submit() {
    const batch = files.length
      ? files
      : code.trim()
        ? [{ name: 'Pasted code', code, language: detectLanguageFromCode(code, language) }]
        : []
    if (!batch.length) {
      setError('Add a source file or paste code before starting analysis.')
      textareaRef.current?.focus()
      return
    }
    if (batch.some((file) => new Blob([file.code]).size > MAX_SOURCE_BYTES)) {
      setError('Each source file or pasted snippet must be 200 KB or smaller.')
      return
    }
    if (batch.length > MAX_BATCH_FILES || batch.reduce((sum, file) => sum + new Blob([file.code]).size, 0) > MAX_BATCH_BYTES) {
      setError(`Batch exceeds the safety limit of ${MAX_BATCH_FILES} files or 2 MB total.`)
      return
    }
    setError('')
    onAnalyze(batch)
  }

  function loadSample() {
    onFilesChange([])
    onCodeChange(SAMPLES[language] || '')
    setError('')
    textareaRef.current?.focus()
  }

  return (
    <section className="screen screen--input" aria-labelledby="hero-title"
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}>
      <div className="hero">
        <span className="eyebrow"><span className="eyebrow__dot" aria-hidden="true" />Pre-emptive code analysis</span>
        <h1 className="hero__title" id="hero-title">See Tomorrow&apos;s <span className="hero__accent">Bug Report</span> Today</h1>
        <p className="hero__sub">Drop or select source files, upload a folder, or paste a snippet. Up to {MAX_BATCH_FILES} files and 2 MB per batch.</p>
      </div>

      <form className={`panel${dragging ? ' panel--dragging' : ''}`} onSubmit={(event) => { event.preventDefault(); submit() }}>
        <div className="panel__toolbar">
          <div className="field">
            <label htmlFor="language">Language (for pasted code)</label>
            <div className="select-wrap">
              <select id="language" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
                {Object.entries(LANGUAGES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
              <ChevronDownIcon className="select-wrap__icon" />
            </div>
          </div>
          <div className="panel__meta">
            <span className="chip">{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
            {files.length > 0 && <span className="chip">{files.length} file{files.length === 1 ? '' : 's'} queued</span>}
            <input id="source-file" className="visually-hidden" type="file" accept={ACCEPTED} multiple onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
            <label className="link-btn" htmlFor="source-file">Add files</label>
            <input id="source-folder" className="visually-hidden" type="file" accept={ACCEPTED} multiple webkitdirectory="" onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
            <label className="link-btn" htmlFor="source-folder">Add folder</label>
            <button type="button" className="link-btn" onClick={loadSample}>Load sample</button>
            {files.length > 0 && <button type="button" className="link-btn" onClick={() => onFilesChange([])}>Clear files</button>}
          </div>
        </div>

        {replacementNotice && <p className="replacement-notice" role="status">{replacementNotice}</p>}

        {files.length > 0 && <div className="file-queue" aria-label="Files queued for analysis">
          {files.map((file, index) => <div className="file-queue__item" key={`${file.name}-${index}`}>
            <span>{file.name} <small>· {LANGUAGES[file.language]?.label || file.language}{file.proposalApplied ? ' · proposal replaces source' : ''}</small></span>
            <button type="button" className="link-btn" aria-label={`Remove ${file.name}`} onClick={() => onFilesChange(files.filter((_, i) => i !== index))}>Remove</button>
          </div>)}
        </div>}

        <div className="drop-hint" aria-live="polite">{dragging ? 'Drop supported source files to add them' : 'Drag and drop supported source files anywhere in this panel'}</div>

        <div className="field field--code">
          <label htmlFor="code">Source code {files.length > 0 ? '(preview of first loaded file)' : ''}</label>
          <div className={`editor${error ? ' editor--error' : ''}`}>
            <textarea id="code" ref={textareaRef} autoFocus spellCheck="false" value={code}
              onChange={(event) => {
                const nextCode = event.target.value
                onCodeChange(nextCode)
                onLanguageChange(detectLanguageFromCode(nextCode, language))
                if (error) setError('')
              }}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit() } }}
              placeholder="Paste code here, or drop source files..." aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'code-error' : 'code-hint'} />
          </div>
          {error ? <p className="form-error" id="code-error" role="alert"><AlertIcon size={14} />{error}</p>
            : <p className="hint" id="code-hint">Files are analyzed separately. Batch limit: {MAX_BATCH_FILES} files, 2 MB total; each file up to 200 KB. Folder uploads include supported source files only.</p>}
        </div>

        <div className="panel__actions">
          <button type="submit" className="btn btn--primary">Analyze {files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'}` : 'Code'}<ArrowRightIcon size={17} /></button>
          <span className="shortcut"><kbd>Ctrl</kbd><span aria-hidden="true">+</span><kbd>Enter</kbd><span>to analyze</span></span>
        </div>
      </form>
    </section>
  )
}
