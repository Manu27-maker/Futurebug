/* ================================================================== */
/* FutureBug — App                                                    */
/* Manages screen state (input / loading / results) and theme.        */
/* ================================================================== */

import { useEffect, useRef, useState } from 'react'
import InputScreen from './components/InputScreen.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import ResultsScreen from './components/ResultsScreen.jsx'
import { getInitialTheme, THEME_KEY } from './mockData.js'
import { SunIcon, MoonIcon, BugIcon } from './components/icons.jsx'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000'

export default function App() {
  const [screen, setScreen] = useState('input')
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState('')
  const [files, setFiles] = useState([])
  const [analysis, setAnalysis] = useState({ code: '', language: 'python' })
  const [analysisItems, setAnalysisItems] = useState([])
  const [replacementNotice, setReplacementNotice] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0, completed: 0 })
  const [cancelledBatch, setCancelledBatch] = useState(false)
  const [theme, setTheme] = useState(getInitialTheme)
  const timerRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => () => {
    window.clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem(THEME_KEY, theme) } catch { /* Best effort. */ }
    const themeColor = document.querySelector('meta[name="theme-color"]')
    if (themeColor) themeColor.setAttribute('content', theme === 'dark' ? '#080b11' : '#f4f7fb')
  }, [theme])

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  async function handleAnalyze(sources) {
    window.clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()
    setAnalysis(sources[0] || { code: '', language })
    setAnalysisItems([])
    setCancelledBatch(false)
    setProgress({ current: 0, total: sources.length, completed: 0 })
    setScreen('loading')
    const controller = new AbortController()
    abortRef.current = controller
    const completed = []
    let cancelled = false
    let interruptedIndex = null

    for (let index = 0; index < sources.length; index += 1) {
      if (controller.signal.aborted) { cancelled = true; interruptedIndex = index; break }
      const source = sources[index]
      setAnalysis(source)
      setProgress({ current: index + 1, total: sources.length, completed: completed.length })
      try {
        const response = await fetch(`${API_BASE_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: source.code, language: source.language, filename: source.name }),
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || data.error || `Backend returned HTTP ${response.status}`)
        completed.push({
          ...source,
          results: data.results ?? [],
          diagnostics: data.diagnostics ?? [],
          improvedCode: data.improved_code || '',
          improvementSummary: data.improvement_summary || '',
          improvementMessage: data.improvement_message || '',
          error: '',
        })
      } catch (error) {
        if (error.name === 'AbortError') { cancelled = true; interruptedIndex = index; break }
        const message = error instanceof TypeError
          ? 'Cannot reach the FutureBug backend. Start it with run.bat, confirm its port, then retry this file.'
          : (error.message || 'Analysis failed. Check the backend connection and try again.')
        completed.push({ ...source, results: [], diagnostics: [], error: message })
      }
      setProgress({ current: Math.min(index + 1, sources.length), total: sources.length, completed: completed.length })
    }

    if (cancelled) {
      const remaining = sources.slice(completed.length).map((source, offset) => ({
        ...source,
        results: [],
        diagnostics: [],
        cancelled: true,
        cancelMessage: completed.length + offset === interruptedIndex
          ? 'Analysis was canceled while this file was in progress.'
          : 'Not analyzed: batch canceled before this file started.',
      }))
      setCancelledBatch(true)
      setAnalysisItems([...completed, ...remaining])
    } else {
      setAnalysisItems(completed)
    }
    setProgress({ current: cancelled ? completed.length : sources.length, total: sources.length, completed: completed.length })
    setScreen('results')
    abortRef.current = null
  }

  function handleCancel() {
    abortRef.current?.abort()
  }

  function handleReset() {
    window.clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = null
    setAnalysisItems([])
    setFiles([])
    setCode('')
    setReplacementNotice('')
    setScreen('input')
  }

  function handleReplaceSource(index, proposedCode) {
    const selectedSource = analysisItems[index]
    if (!selectedSource?.improvedCode || selectedSource.improvedCode !== proposedCode) return

    if (files.length) {
      const updatedFiles = files.map((file, fileIndex) => fileIndex === index
        ? { ...file, code: proposedCode, proposalApplied: true }
        : file)
      setFiles(updatedFiles)
      setCode(updatedFiles[0]?.code || '')
      setLanguage(updatedFiles[0]?.language || selectedSource.language)
      setReplacementNotice(`The proposal replaced ${selectedSource.name} in the in-app batch. The original file on disk was not changed; review the queue and analyze again when ready.`)
    } else {
      setCode(proposedCode)
      setLanguage(selectedSource.language)
      setReplacementNotice('The proposal replaced the pasted source in FutureBug. Review it and analyze again when ready; no original file on disk was changed.')
    }

    setAnalysisItems([])
    setCancelledBatch(false)
    setScreen('input')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <AppHeader theme={theme} onToggleTheme={toggleTheme} />
      <main className="app-main" id="main">
        {screen === 'input' && <InputScreen language={language} onLanguageChange={setLanguage} code={code} onCodeChange={setCode} onAnalyze={handleAnalyze} files={files} onFilesChange={setFiles} replacementNotice={replacementNotice} />}
        {screen === 'loading' && <LoadingScreen code={analysis.code} language={analysis.language} progress={progress} onCancel={handleCancel} />}
        {screen === 'results' && <ResultsScreen analyses={analysisItems} theme={theme} onReset={handleReset} onReplaceSource={handleReplaceSource} cancelled={cancelledBatch} />}
      </main>
      <AppFooter />
    </div>
  )
}

function AppHeader({ theme, onToggleTheme }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  return (
    <header className="app-header">
      <div className="brand"><span className="brand__mark" aria-hidden="true"><BugIcon size={19} /></span><span className="brand__name">Future<span>Bug</span></span></div>
      <div className="app-header__actions">
        <div className="app-header__status"><span className="status-dot" aria-hidden="true" /><span className="app-header__status-text">Local analyzer</span><span className="app-header__version">v0.1</span></div>
        <button type="button" className="theme-toggle" data-theme={theme} onClick={onToggleTheme} role="switch" aria-checked={theme === 'dark'} aria-label="Dark theme" title={`Switch to ${nextTheme} theme`}>
          <span className="theme-toggle__thumb" aria-hidden="true" /><span className="theme-toggle__option theme-toggle__option--sun"><SunIcon size={13} /></span><span className="theme-toggle__option theme-toggle__option--moon"><MoonIcon size={13} /></span>
        </button>
      </div>
    </header>
  )
}

function AppFooter() {
  return <footer className="app-footer"><div className="app-footer__inner"><span>FutureBug — pre-emptive code analysis</span><span>Static analysis · optional AI report text</span></div></footer>
}
