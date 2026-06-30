import { useState, useEffect } from 'react'
import { getClient, saveCredentials, clearCredentials, hasCredentials, testConnection } from './supabase'

const STORAGE_KEY = 'pr-tracker-data'
const SPRINT_KEY = 'pr-tracker-sprint'

const COLUMNS = [
  { id: 'dev', label: 'Dev', color: 'bg-blue-100 border-blue-400' },
  { id: 'qa', label: 'QA', color: 'bg-purple-100 border-purple-400' },
  { id: 'prod', label: 'Prod', color: 'bg-green-100 border-green-400' },
]

const STATUS_COLORS = {
  dev: { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
  qa: { bg: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50' },
  prod: { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50' },
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
}

function saveLocal(prs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prs))
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`
  return '< 1h'
}

function ageColor(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = diff / 86400000
  if (days < 2) return 'text-green-600'
  if (days < 5) return 'text-yellow-600'
  return 'text-red-600'
}

function CardModal({ pr, onClose, onMove, onDelete, onUpdateNotes, onUpdateSprint, onUpdateFigma, allSprints }) {
  if (!pr) return null
  const col = COLUMNS.find(c => c.id === pr.status)
  const prevCol = COLUMNS[COLUMNS.findIndex(c => c.id === pr.status) - 1]
  const nextCol = COLUMNS[COLUMNS.findIndex(c => c.id === pr.status) + 1]
  const [notes, setNotes] = useState(pr.notes || '')
  const [editingSprint, setEditingSprint] = useState(false)
  const [sprintInput, setSprintInput] = useState(pr.sprint || '')
  const [editingFigma, setEditingFigma] = useState(false)
  const [figmaInput, setFigmaInput] = useState(pr.figmaUrl || '')

  useEffect(() => {
    setNotes(pr.notes || '')
    setSprintInput(pr.sprint || '')
    setFigmaInput(pr.figmaUrl || '')
  }, [pr.id])

  function saveSprint() {
    if (sprintInput !== (pr.sprint || '')) onUpdateSprint(pr.id, sprintInput)
    setEditingSprint(false)
  }

  function handleMove(target) {
    onMove(pr.id, target)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 pr-4 break-words">{pr.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sprint</label>
            {editingSprint ? (
              <div className="flex gap-1.5 mt-1">
                <input value={sprintInput} onChange={e => setSprintInput(e.target.value)} onBlur={saveSprint} onKeyDown={e => { if (e.key === 'Enter') saveSprint(); if (e.key === 'Escape') { setSprintInput(pr.sprint || ''); setEditingSprint(false) } }} className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" autoFocus />
                {allSprints.filter(s => s !== pr.sprint).slice(0, 5).map(s => (
                  <button key={s} onMouseDown={e => e.preventDefault()} onClick={() => { setSprintInput(s); onUpdateSprint(pr.id, s); setEditingSprint(false) }} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer">{s}</button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-gray-800 font-medium">{pr.sprint || '—'}</p>
                <button onClick={() => setEditingSprint(true)} className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer">edit</button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Figma</label>
            {editingFigma ? (
              <div className="flex gap-1.5 mt-1">
                <input value={figmaInput} onChange={e => setFigmaInput(e.target.value)} onBlur={() => { if (figmaInput !== (pr.figmaUrl || '')) onUpdateFigma(pr.id, figmaInput); setEditingFigma(false) }} onKeyDown={e => { if (e.key === 'Enter') { if (figmaInput !== (pr.figmaUrl || '')) onUpdateFigma(pr.id, figmaInput); setEditingFigma(false) }; if (e.key === 'Escape') { setFigmaInput(pr.figmaUrl || ''); setEditingFigma(false) } }} className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" autoFocus />
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-sm truncate ${pr.figmaUrl ? 'text-pink-600' : 'text-gray-400'}`}>{pr.figmaUrl || '—'}</p>
                <button onClick={() => setEditingFigma(true)} className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer">edit</button>
              </div>
            )}
          </div>

          {pr.prUrl && <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wide">PR Link</label><p className="block text-sm text-indigo-600 truncate mt-0.5">{pr.prUrl}</p></div>}
          {pr.jiraTicket && <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Jira Ticket</label><p className="block text-sm text-purple-600 mt-0.5">{pr.jiraTicket}</p></div>}

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
            <p className="text-sm text-gray-800 mt-0.5 font-medium">{col?.label || pr.status}</p>
          </div>

          <div className="flex gap-6">
            <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</label><p className="text-sm text-gray-600 mt-0.5">{new Date(pr.createdAt).toLocaleDateString()}</p></div>
            {pr.statusChangedAt && <div><label className="text-xs font-medium text-gray-500 uppercase tracking-wide">In {col?.label}</label><p className={`text-sm font-medium mt-0.5 ${ageColor(pr.statusChangedAt)}`}>{timeAgo(pr.statusChangedAt)}</p></div>}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{pr.status === 'prod' ? 'Prod Notes' : 'Changes Needed'}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => { if (notes !== (pr.notes || '')) onUpdateNotes(pr.id, notes) }} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none" placeholder="What changes are needed here?" />
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
          {prevCol && <button onClick={() => handleMove(prevCol.id)} className="px-3 py-1.5 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">← {prevCol.label}</button>}
          {nextCol && <button onClick={() => handleMove(nextCol.id)} className="px-3 py-1.5 text-sm rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 cursor-pointer">{nextCol.label} →</button>}
          <button onClick={() => { onDelete(pr.id); onClose() }} className="px-3 py-1.5 text-sm rounded bg-red-50 text-red-500 hover:bg-red-100 ml-auto cursor-pointer">Delete</button>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ prs, onSelectSprint, setSelectedPr }) {
  const sprints = [...new Set(prs.map(p => p.sprint).filter(Boolean))].sort().reverse()


  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-sm text-gray-500 font-medium">Total PRs</p><p className="text-3xl font-bold text-gray-900 mt-1">{prs.length}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><p className="text-sm text-gray-500 font-medium">In Dev</p></div><p className="text-3xl font-bold text-blue-600 mt-1">{prs.filter(p => p.status === 'dev').length}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-5"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><p className="text-sm text-gray-500 font-medium">In QA</p></div><p className="text-3xl font-bold text-purple-600 mt-1">{prs.filter(p => p.status === 'qa').length}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-5"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><p className="text-sm text-gray-500 font-medium">In Prod</p></div><p className="text-3xl font-bold text-green-600 mt-1">{prs.filter(p => p.status === 'prod').length}</p></div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sprints</h2>
        {sprints.length === 0 && <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center"><p className="text-gray-400 text-sm">No PRs yet. Add your first PR to get started!</p></div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sprints.map(sprint => {
            const sprintPrs = prs.filter(p => p.sprint === sprint)
            const sDev = sprintPrs.filter(p => p.status === 'dev').length
            const sQa = sprintPrs.filter(p => p.status === 'qa').length
            const sProd = sprintPrs.filter(p => p.status === 'prod').length
            const sTotal = sprintPrs.length
            const latest = sprintPrs.reduce((a, b) => a.createdAt > b.createdAt ? a : b, sprintPrs[0])
            return (
              <div key={sprint} onClick={() => onSelectSprint(sprint)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-gray-900">{sprint}</h3><span className="text-sm font-medium text-gray-500">{sTotal} PR{sTotal !== 1 ? 's' : ''}</span></div>
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mb-3">
                  <div className="bg-blue-500 transition-all" style={{ width: `${(sDev / sTotal) * 100}%` }} />
                  <div className="bg-purple-500 transition-all" style={{ width: `${(sQa / sTotal) * 100}%` }} />
                  <div className="bg-green-500 transition-all" style={{ width: `${(sProd / sTotal) * 100}%` }} />
                </div>
                <div className="flex gap-3 text-xs"><span className="text-blue-600 font-medium">{sDev} Dev</span><span className="text-purple-600 font-medium">{sQa} QA</span><span className="text-green-600 font-medium">{sProd} Prod</span></div>
                <p className="text-xs text-gray-400 mt-2">Latest: {new Date(latest.createdAt).toLocaleDateString()}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent PRs</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {prs.slice(0, 10).map(pr => {
            const sc = STATUS_COLORS[pr.status]
            return (
              <div key={pr.id} onClick={() => setSelectedPr(pr)} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className={`w-2 h-2 rounded-full ${sc.bg} shrink-0`} />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{pr.title}</p><p className="text-xs text-gray-400 truncate">{pr.sprint}{pr.jiraTicket ? ` · ${pr.jiraTicket}` : ''}</p></div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.light} ${sc.text} shrink-0`}>{COLUMNS.find(c => c.id === pr.status)?.label || pr.status}</span>
              </div>
            )
          })}
          {prs.length === 0 && <div className="p-10 text-center"><p className="text-gray-400 text-sm">No PRs yet.</p></div>}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [prs, setPrs] = useState(loadLocal)
  const [currentSprint, setCurrentSprint] = useState(() => { try { return localStorage.getItem(SPRINT_KEY) || '' } catch { return '' } })
  const [showForm, setShowForm] = useState(false)
  const [selectedPr, setSelectedPr] = useState(null)
  const [form, setForm] = useState({ title: '', prUrl: '', jiraTicket: '', figmaUrl: '', sprint: '' })
  const [showSprintPicker, setShowSprintPicker] = useState(false)
  const [showFormSprintPicker, setShowFormSprintPicker] = useState(false)

  const [supabaseConnected, setSupabaseConnected] = useState(hasCredentials())
  const [showDbModal, setShowDbModal] = useState(false)
  const [dbUrl, setDbUrl] = useState('')
  const [dbKey, setDbKey] = useState('')
  const [dbStatus, setDbStatus] = useState(null)

  useEffect(() => { saveLocal(prs) }, [prs])
  useEffect(() => { localStorage.setItem(SPRINT_KEY, currentSprint) }, [currentSprint])
  useEffect(() => { setForm(f => ({ ...f, sprint: currentSprint })) }, [currentSprint])

  const allSprints = [...new Set(prs.map(p => p.sprint).filter(Boolean))].sort()

  useEffect(() => {
    if (hasCredentials()) {
      setSupabaseConnected(true)
    }
  }, [])

  async function syncToSupabase(data) {
    const sb = getClient()
    if (!sb) return
    try {
      const { error: delErr } = await sb.from('prs').delete().neq('id', 'none')
      if (delErr) throw delErr
      const { error: insErr } = await sb.from('prs').insert(data.map(p => ({
        id: p.id, title: p.title, pr_url: p.prUrl, jira_ticket: p.jiraTicket,
        figma_url: p.figmaUrl, sprint: p.sprint, status: p.status,
        notes: p.notes, created_at: p.createdAt, status_changed_at: p.statusChangedAt,
      })))
      if (insErr) throw insErr
    } catch (err) {
      console.error('Supabase sync error:', err)
    }
  }

  useEffect(() => {
    if (supabaseConnected && prs.length > 0) {
      syncToSupabase(prs)
    }
  }, [prs])

  async function connectSupabase() {
    setDbStatus({ type: 'loading', text: 'Connecting...' })
    saveCredentials(dbUrl.trim(), dbKey.trim())
    try {
      await testConnection()
      setSupabaseConnected(true)

      const sb = getClient()
      const { data: existing } = await sb.from('prs').select('*')
      if (existing && existing.length > 0) {
        const mapped = existing.map(r => ({
          id: r.id, title: r.title, prUrl: r.pr_url || '', jiraTicket: r.jira_ticket || '',
          figmaUrl: r.figma_url || '', sprint: r.sprint || '', status: r.status || 'dev',
          notes: r.notes || '', createdAt: r.created_at, statusChangedAt: r.status_changed_at || r.created_at,
        }))
        setPrs(mapped)
        setDbStatus({ type: 'success', text: `Loaded ${mapped.length} PRs from database` })
      } else {
        if (prs.length > 0) await syncToSupabase(prs)
        setDbStatus({ type: 'success', text: 'Connected. Data synced.' })
      }
    } catch (err) {
      setDbStatus({ type: 'error', text: err.message })
      clearCredentials()
    }
  }

  async function disconnectSupabase() {
    clearCredentials()
    setSupabaseConnected(false)
    setDbStatus(null)
    setShowDbModal(false)
  }

  function addPr(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    const newPr = {
      id: generateId(), title: form.title.trim(), prUrl: form.prUrl.trim(),
      jiraTicket: form.jiraTicket.trim(), figmaUrl: form.figmaUrl.trim(),
      sprint: form.sprint.trim() || currentSprint,
      status: 'dev', notes: '', createdAt: new Date().toISOString(),
      statusChangedAt: new Date().toISOString(),
    }
    setPrs([newPr, ...prs])
    setForm({ title: '', prUrl: '', jiraTicket: '', figmaUrl: '', sprint: currentSprint })
    setShowForm(false)
  }

  function movePr(id, newStatus) {
    setPrs(prs.map(p => p.id === id ? { ...p, status: newStatus, statusChangedAt: new Date().toISOString() } : p))
  }

  function updateNotes(id, notes) { setPrs(prs.map(p => p.id === id ? { ...p, notes } : p)) }
  function updateSprint(id, sprint) { setPrs(prs.map(p => p.id === id ? { ...p, sprint } : p)) }
  function updateFigma(id, figmaUrl) { setPrs(prs.map(p => p.id === id ? { ...p, figmaUrl } : p)) }
  function deletePr(id) { setPrs(prs.filter(p => p.id !== id)) }
  function getColumnPrs(status) { return prs.filter(p => p.status === status && p.sprint === currentSprint) }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">PR Tracker</h1>
            {supabaseConnected && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">DB</span>}
            <div className="relative">
              <button onClick={() => setShowSprintPicker(!showSprintPicker)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                {currentSprint || 'Dashboard'}
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showSprintPicker && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-60 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100">
                    <input type="text" placeholder="+ New sprint..." className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { setCurrentSprint(e.target.value.trim()); setShowSprintPicker(false) } }} />
                  </div>
                  <button onClick={() => { setCurrentSprint(''); setShowSprintPicker(false) }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!currentSprint ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>Dashboard</button>
                  {allSprints.map(s => (
                    <button key={s} onClick={() => { setCurrentSprint(s); setShowSprintPicker(false) }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${currentSprint === s ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setDbUrl(''); setDbKey(''); setDbStatus(null); setShowDbModal(true) }} className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer" title="Database Settings">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
            </button>
            <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors cursor-pointer">+ Add PR</button>
          </div>
        </div>

        {currentSprint && (
          <div className="mb-1"><button onClick={() => setCurrentSprint('')} className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 inline-block cursor-pointer">← Back to Dashboard</button></div>
        )}

        {/* Add PR Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Pull Request</h2>
              <form onSubmit={addPr} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="e.g. Add user authentication" autoFocus /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">PR URL</label><input type="url" value={form.prUrl} onChange={e => setForm({ ...form, prUrl: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="https://github.com/org/repo/pull/1" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Jira Ticket</label><input type="text" value={form.jiraTicket} onChange={e => setForm({ ...form, jiraTicket: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="e.g. PROJ-123" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Figma URL</label><input type="url" value={form.figmaUrl} onChange={e => setForm({ ...form, figmaUrl: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="https://figma.com/file/..." /></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sprint</label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <input type="text" value={form.sprint} onChange={e => setForm({ ...form, sprint: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="e.g. Sprint 51" />
                      <button type="button" onClick={() => setShowFormSprintPicker(f => !f)} className="px-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 cursor-pointer"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    {showFormSprintPicker && (
                      <div className="absolute top-full right-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        <div className="p-2 border-b border-gray-100"><input type="text" placeholder="+ New sprint..." className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { setForm(f => ({ ...f, sprint: e.target.value.trim() })); setShowFormSprintPicker(false) } }} autoFocus /></div>
                        {allSprints.map(s => (<button key={s} type="button" onClick={() => { setForm(f => ({ ...f, sprint: s })); setShowFormSprintPicker(false) }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${form.sprint === s ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>{s}</button>))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors cursor-pointer">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors cursor-pointer">Add PR</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Supabase Settings Modal */}
        {showDbModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDbModal(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Database</h2>
                <button onClick={() => setShowDbModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">&times;</button>
              </div>

              {supabaseConnected ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-green-800 font-medium">Connected to Supabase</p>
                  </div>
                  <p className="text-sm text-gray-500">All changes are automatically synced to the database.</p>
                  <button onClick={disconnectSupabase} className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors cursor-pointer">Disconnect</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Enter your Supabase project credentials (Settings → API).</p>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Project URL</label><input type="text" value={dbUrl} onChange={e => setDbUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="https://xxxxx.supabase.co" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">anon / public key</label><input type="text" value={dbKey} onChange={e => setDbKey(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="eyJhbGciOiJIUzI1NiIs..." /></div>
                  {dbStatus && (
                    <div className={`text-sm px-3 py-2 rounded-lg ${dbStatus.type === 'error' ? 'bg-red-50 text-red-700' : dbStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                      {dbStatus.text}
                    </div>
                  )}
                  <button onClick={connectSupabase} disabled={!dbUrl || !dbKey} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors cursor-pointer">Connect</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        {currentSprint ? (
          <>
            <div className="mb-4 text-sm text-gray-500">Showing <span className="font-medium text-gray-700">{currentSprint}</span> · {prs.filter(p => p.sprint === currentSprint).length} PRs</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map(col => {
                const columnPrs = getColumnPrs(col.id)
                return (
                  <div key={col.id} className="bg-gray-100 rounded-xl p-4 min-h-[300px]">
                    <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-lg border-2 ${col.color}`}>
                      <h3 className="font-semibold text-gray-800">{col.label}</h3>
                      <span className="text-sm font-medium text-gray-500 bg-white/60 px-2 py-0.5 rounded-full">{columnPrs.length}</span>
                    </div>
                    <div className="space-y-2">
                      {columnPrs.map(pr => (
                        <div key={pr.id} onClick={() => setSelectedPr(pr)} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {pr.jiraTicket && <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{pr.jiraTicket}</span>}
                            {pr.figmaUrl && <span className="text-xs text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded">figma</span>}
                          </div>
                          <h4 className="font-medium text-gray-900 text-sm leading-snug">{pr.title}</h4>
                          {pr.prUrl && <p className="text-xs text-gray-400 truncate mt-1">{pr.prUrl.replace(/^https?:\/\//, '')}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-gray-400">{new Date(pr.createdAt).toLocaleDateString()}</span>
                            {pr.statusChangedAt && <span className={`text-xs font-medium ${ageColor(pr.statusChangedAt)}`}>{timeAgo(pr.statusChangedAt)}</span>}
                            {pr.notes ? <span className="text-xs text-gray-400">· notes</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <Dashboard prs={prs} onSelectSprint={setCurrentSprint} setSelectedPr={setSelectedPr} />
        )}
      </div>

      {selectedPr && (
        <CardModal pr={selectedPr} onClose={() => setSelectedPr(null)} onMove={movePr} onDelete={deletePr} onUpdateNotes={updateNotes} onUpdateSprint={updateSprint} onUpdateFigma={updateFigma} allSprints={allSprints} />
      )}
    </div>
  )
}
