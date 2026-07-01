import { useState, useEffect } from 'react'
import { getClient, saveCredentials, clearCredentials, hasCredentials, testConnection } from './supabase'

const STORAGE_KEY = 'pr-tracker-data'
const SPRINT_KEY = 'pr-tracker-sprint'
const PROJECT_KEY = 'pr-tracker-project'
const PROJECTS_LIST_KEY = 'pr-tracker-projects-list'

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

function ageTimestamp(pr) {
  return pr.pausedAt || pr.statusChangedAt
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

function PauseIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg> }
function PlayIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg> }

function Pencil() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> }
function Check() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> }
function XIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> }
function XIconSmall() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> }

function normalizeArray(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val) return [val]
  return []
}

function normalizePrUrls(pr) {
  const raw = pr.prUrls || pr.prUrl
  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? [raw] : [])
  return arr.map((item, i) =>
    typeof item === 'string'
      ? { id: (pr.id || 'pr') + '-url-' + i, name: `PR ${i + 1}`, url: item }
      : item
  )
}

function normalizeComments(pr) {
  if (Array.isArray(pr.comments)) return pr.comments
  if (typeof pr.notes === 'string' && pr.notes.trim()) {
    return [{ id: (pr.id || 'note') + '-migrated', text: pr.notes, createdAt: pr.createdAt || new Date().toISOString() }]
  }
  return []
}

function LinkList({ label, items, color, onAdd, onRemove, onUpdate, inputPlaceholder }) {
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  const [editInput, setEditInput] = useState('')

  function handleAdd() {
    if (input.trim()) { onAdd(input.trim()); setInput(''); setAdding(false) }
  }

  function handleSaveEdit(idx) {
    if (editInput.trim()) { onUpdate(idx, editInput.trim()); setEditingIdx(null); setEditInput('') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
        <button onClick={() => { setAdding(true); setEditingIdx(null) }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer">+ Add</button>
      </div>
      {adding && (
        <div className="flex items-center gap-1 mb-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setInput(''); setAdding(false) } }} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder={inputPlaceholder} autoFocus />
          <button onClick={handleAdd} className="p-1.5 rounded text-green-600 hover:bg-green-50 cursor-pointer"><Check /></button>
          <button onClick={() => { setInput(''); setAdding(false) }} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 cursor-pointer"><XIcon /></button>
        </div>
      )}
      <div className="space-y-1">
        {(items || []).map((item, idx) => (
          <div key={idx} className="group flex items-center gap-1.5">
            {editingIdx === idx ? (
              <div className="flex items-center gap-1 flex-1">
                <input value={editInput} onChange={e => setEditInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(idx); if (e.key === 'Escape') { setEditingIdx(null) } }} className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus />
                <button onClick={() => handleSaveEdit(idx)} className="p-1 rounded text-green-600 hover:bg-green-50 cursor-pointer"><Check /></button>
                <button onClick={() => setEditingIdx(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100 cursor-pointer"><XIcon /></button>
              </div>
            ) : (
              <>
                <span className={`text-sm truncate flex-1 ${color}`}>{item}</span>
                <button onClick={() => { setEditingIdx(idx); setEditInput(item); setAdding(false) }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity cursor-pointer"><Pencil /></button>
                <button onClick={() => onRemove(idx)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity cursor-pointer"><XIconSmall /></button>
              </>
            )}
          </div>
        ))}
        {(!items || items.length === 0) && !adding && <p className="text-sm text-gray-400 italic">None</p>}
      </div>
    </div>
  )
}

function PrLinkList({ items, onAdd, onRemove, onUpdate }) {
  const [adding, setAdding] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')

  function handleAdd() {
    if (urlInput.trim()) {
      onAdd({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: nameInput.trim() || `PR ${(items || []).length + 1}`, url: urlInput.trim() })
      setNameInput(''); setUrlInput(''); setAdding(false)
    }
  }

  function handleSaveEdit(idx) {
    if (editUrl.trim()) {
      onUpdate(idx, { ...items[idx], name: editName.trim() || items[idx].name, url: editUrl.trim() })
      setEditingIdx(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">PR Links</label>
        <button onClick={() => { setAdding(true); setEditingIdx(null) }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer">+ Add</button>
      </div>
      {adding && (
        <div className="mb-2 space-y-1.5">
          <input value={nameInput} onChange={e => setNameInput(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Name (e.g. Dev PR, QA PR)" autoFocus />
          <div className="flex gap-1">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNameInput(''); setUrlInput('') } }} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="https://github.com/..." />
            <button onClick={handleAdd} className="p-1.5 rounded text-green-600 hover:bg-green-50 cursor-pointer"><Check /></button>
            <button onClick={() => { setAdding(false); setNameInput(''); setUrlInput('') }} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 cursor-pointer"><XIcon /></button>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {(items || []).map((item, idx) => (
          <div key={item.id || idx} className="group flex items-center gap-1.5">
            {editingIdx === idx ? (
              <div className="flex-1 space-y-1.5">
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Name" autoFocus />
                <div className="flex gap-1">
                  <input value={editUrl} onChange={e => setEditUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(idx); if (e.key === 'Escape') setEditingIdx(null) }} className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="URL" />
                  <button onClick={() => handleSaveEdit(idx)} className="p-1 rounded text-green-600 hover:bg-green-50 cursor-pointer"><Check /></button>
                  <button onClick={() => setEditingIdx(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100 cursor-pointer"><XIcon /></button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline truncate block">{item.name}</a>
                  <span className="text-xs text-gray-400 truncate block">{item.url.replace(/^https?:\/\//, '')}</span>
                </div>
                <button onClick={() => { setEditingIdx(idx); setEditName(item.name); setEditUrl(item.url); setAdding(false) }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity cursor-pointer"><Pencil /></button>
                <button onClick={() => onRemove(idx)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity cursor-pointer"><XIconSmall /></button>
              </>
            )}
          </div>
        ))}
        {(!items || items.length === 0) && !adding && <p className="text-sm text-gray-400 italic">None</p>}
      </div>
    </div>
  )
}

function CardModal({ pr, onClose, onMove, onDelete, onAddComment, onDeleteComment, onUpdateSprint, onUpdateProject, onAddPrUrl, onRemovePrUrl, onUpdatePrUrl, onAddJiraTicket, onRemoveJiraTicket, onUpdateJiraTicket, onAddFigmaUrl, onRemoveFigmaUrl, onUpdateFigmaUrl, onUpdateTitle, onTogglePause, allSprints, allProjects }) {
  if (!pr) return null
  const col = COLUMNS.find(c => c.id === pr.status)
  const prevCol = COLUMNS[COLUMNS.findIndex(c => c.id === pr.status) - 1]
  const nextCol = COLUMNS[COLUMNS.findIndex(c => c.id === pr.status) + 1]
  const [newComment, setNewComment] = useState('')
  const [editingSprint, setEditingSprint] = useState(false)
  const [sprintInput, setSprintInput] = useState(pr.sprint || '')
  const [editingProject, setEditingProject] = useState(false)
  const [projectInput, setProjectInput] = useState(pr.project || '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(pr.title || '')

  const prUrls = normalizePrUrls(pr)
  const jiraTickets = normalizeArray(pr.jiraTickets || pr.jiraTicket)
  const figmaUrls = normalizeArray(pr.figmaUrls || pr.figmaUrl)
  const comments = normalizeComments(pr)

  useEffect(() => {
    setNewComment('')
    setSprintInput(pr.sprint || '')
    setProjectInput(pr.project || '')
    setTitleInput(pr.title || '')
  }, [pr.id])

  function saveSprint() {
    if (sprintInput !== (pr.sprint || '')) onUpdateSprint(pr.id, sprintInput)
    setEditingSprint(false)
  }

  function handleMove(target) {
    if (editingSprint && sprintInput !== (pr.sprint || '')) onUpdateSprint(pr.id, sprintInput)
    if (editingTitle && titleInput !== (pr.title || '')) onUpdateTitle(pr.id, titleInput)
    setEditingSprint(false); setEditingTitle(false)
    onMove(pr.id, target)
    onClose()
  }

  const sc = STATUS_COLORS[pr.status]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-2 z-10 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input value={titleInput} onChange={e => setTitleInput(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { if (titleInput !== (pr.title || '')) onUpdateTitle(pr.id, titleInput); setEditingTitle(false) }; if (e.key === 'Escape') { setTitleInput(pr.title || ''); setEditingTitle(false) } }} className="flex-1 min-w-0 text-lg font-semibold border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus />
                <button onClick={e => { e.stopPropagation(); if (titleInput !== (pr.title || '')) onUpdateTitle(pr.id, titleInput); setEditingTitle(false) }} className="p-1.5 rounded text-green-600 hover:bg-green-50 cursor-pointer shrink-0"><Check /></button>
                <button onClick={e => { e.stopPropagation(); setTitleInput(pr.title || ''); setEditingTitle(false) }} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 cursor-pointer shrink-0"><XIcon /></button>
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-3 h-3 rounded-full ${sc.bg} shrink-0`} />
                <h2 className="text-lg font-semibold text-gray-900 truncate cursor-pointer group flex items-center gap-2" onClick={() => setEditingTitle(true)}>
                  {pr.title}
                  <span className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity text-sm"><Pencil /></span>
                </h2>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"><XIcon /></button>
        </div>

        <div className="p-6 space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-xl border ${pr.project ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-200 bg-gray-50/40'} p-3`}>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                Project
              </label>
              {editingProject ? (
                <div className="flex items-center gap-1">
                  <select value={projectInput} onChange={e => setProjectInput(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" autoFocus>
                    <option value="">Unassigned</option>
                    {allProjects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={e => { e.stopPropagation(); if (projectInput !== (pr.project || '')) onUpdateProject(pr.id, projectInput); setEditingProject(false) }} className="p-1.5 rounded text-green-600 hover:bg-green-50 cursor-pointer shrink-0"><Check /></button>
                  <button onClick={e => { e.stopPropagation(); setProjectInput(pr.project || ''); setEditingProject(false) }} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 cursor-pointer shrink-0"><XIcon /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => setEditingProject(true)}>
                  <span className={`text-sm font-medium ${pr.project ? 'text-indigo-700' : 'text-gray-400 italic'}`}>{pr.project || 'Unassigned'}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity"><Pencil /></span>
                </div>
              )}
              {!editingProject && allProjects.filter(p => p !== pr.project).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {allProjects.filter(p => p !== pr.project).slice(0, 4).map(p => (
                    <button key={p} onClick={e => { e.stopPropagation(); onUpdateProject(pr.id, p); setProjectInput(p) }} className="text-xs px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors">{p}</button>
                  ))}
                </div>
              )}
            </div>

            <div className={`rounded-xl border ${pr.sprint ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-gray-50/40'} p-3`}>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Sprint
              </label>
              {editingSprint ? (
                <div className="flex items-center gap-1 min-w-0">
                  <input value={sprintInput} onChange={e => setSprintInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveSprint(); if (e.key === 'Escape') { setSprintInput(pr.sprint || ''); setEditingSprint(false) } }} className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus placeholder="Sprint name" />
                  <button onClick={e => { e.stopPropagation(); saveSprint() }} className="p-1.5 rounded text-green-600 hover:bg-green-50 cursor-pointer shrink-0"><Check /></button>
                  <button onClick={e => { e.stopPropagation(); setSprintInput(pr.sprint || ''); setEditingSprint(false) }} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 cursor-pointer shrink-0"><XIcon /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => setEditingSprint(true)}>
                  <span className={`text-sm font-medium ${pr.sprint ? 'text-amber-700' : 'text-gray-400 italic'}`}>{pr.sprint || '—'}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity"><Pencil /></span>
                </div>
              )}
              {!editingSprint && allSprints.filter(s => s !== pr.sprint).slice(0, 4).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {allSprints.filter(s => s !== pr.sprint).slice(0, 4).map(s => (
                    <button key={s} onClick={e => { e.stopPropagation(); onUpdateSprint(pr.id, s); setSprintInput(s) }} className="text-xs px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors">{s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50/60 rounded-xl border border-gray-100 p-3">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Status
              </label>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${sc.bg}`} />
                <span className={`text-sm font-medium ${sc.text}`}>{col?.label || pr.status}</span>
              </div>
            </div>
            <div className="bg-gray-50/60 rounded-xl border border-gray-100 p-3">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Created
              </label>
              <p className="text-sm font-medium text-gray-700">{new Date(pr.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>

          {pr.statusChangedAt && (
            <div className="bg-gray-50/60 rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    In {col?.label}
                  </label>
                  <p className={`text-sm font-medium ${ageColor(ageTimestamp(pr))} ${pr.pausedAt ? 'line-through' : ''}`}>{timeAgo(ageTimestamp(pr))}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); onTogglePause(pr.id) }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${pr.pausedAt ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {pr.pausedAt ? <><PlayIcon /> Resume</> : <><PauseIcon /> Pause</>}
                </button>
              </div>
            </div>
          )}

          <PrLinkList items={prUrls} onAdd={v => onAddPrUrl(pr.id, v)} onRemove={idx => onRemovePrUrl(pr.id, idx)} onUpdate={(idx, v) => onUpdatePrUrl(pr.id, idx, v)} />
          <LinkList label="Jira Tickets" items={jiraTickets} color="text-purple-600" onAdd={v => onAddJiraTicket(pr.id, v)} onRemove={idx => onRemoveJiraTicket(pr.id, idx)} onUpdate={(idx, v) => onUpdateJiraTicket(pr.id, idx, v)} inputPlaceholder="PROJ-123" />
          <LinkList label="Figma URLs" items={figmaUrls} color="text-pink-600" onAdd={v => onAddFigmaUrl(pr.id, v)} onRemove={idx => onRemoveFigmaUrl(pr.id, idx)} onUpdate={(idx, v) => onUpdateFigmaUrl(pr.id, idx, v)} inputPlaceholder="https://figma.com/..." />

          <div className="bg-gray-50/60 rounded-xl border border-gray-100 p-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              {pr.status === 'prod' ? 'Prod Notes' : 'Changes Needed'}
            </label>
            {comments.length > 0 && (
              <div className="max-h-44 overflow-y-auto space-y-2 pr-0.5 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap flex-1 min-w-0 break-words">{c.text}</p>
                      <button onClick={() => onDeleteComment(pr.id, c.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity shrink-0 cursor-pointer p-0.5 rounded hover:bg-red-50"><XIconSmall /></button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">{new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))}
              </div>
            )}
            {comments.length === 0 && <p className="text-sm text-gray-400 italic mb-3">No comments yet.</p>}
            <div className="flex gap-2 items-end">
              <textarea value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (newComment.trim()) { onAddComment(pr.id, newComment.trim()); setNewComment('') } } }} rows={2} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none bg-white" placeholder="Add a comment… (Enter to save, Shift+Enter for new line)" />
              <button onClick={() => { if (newComment.trim()) { onAddComment(pr.id, newComment.trim()); setNewComment('') } }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium cursor-pointer">Save</button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center gap-2 rounded-b-2xl">
          {prevCol && <button onClick={() => handleMove(prevCol.id)} className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 cursor-pointer transition-colors">← {prevCol.label}</button>}
          {nextCol && <button onClick={() => handleMove(nextCol.id)} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 cursor-pointer transition-colors">{nextCol.label} →</button>}
          <button onClick={() => { onDelete(pr.id); onClose() }} className="px-3 py-1.5 text-sm rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 hover:border-red-300 ml-auto cursor-pointer transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

function ProjectsOverview({ prs, onSelectProject }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const projects = [...new Set(prs.map(p => p.project).filter(Boolean))].sort()

  function handleCreate() {
    if (newName.trim()) { onSelectProject(newName.trim()); setNewName(''); setCreating(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
        <button onClick={() => setCreating(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium cursor-pointer">+ New Project</button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Project name</p>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="e.g. Fogo, Backend API…" autoFocus />
            <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium cursor-pointer">Create</button>
            <button onClick={() => { setCreating(false); setNewName('') }} className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {projects.length === 0 && !creating && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <p className="text-gray-800 font-semibold text-lg mb-1">No projects yet</p>
          <p className="text-sm text-gray-400 mb-5">Create a project to start tracking your PRs</p>
          <button onClick={() => setCreating(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm cursor-pointer">Create your first project</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => {
          const pp = prs.filter(p => p.project === project)
          const sDev = pp.filter(p => p.status === 'dev').length
          const sQa = pp.filter(p => p.status === 'qa').length
          const sProd = pp.filter(p => p.status === 'prod').length
          const sTotal = pp.length
          const sprintCount = [...new Set(pp.map(p => p.sprint).filter(Boolean))].length
          return (
            <div key={project} onClick={() => onSelectProject(project)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">{project}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{sprintCount} sprint{sprintCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mb-3">
                {sTotal > 0 && <>
                  <div className="bg-blue-500 transition-all" style={{ width: `${(sDev / sTotal) * 100}%` }} />
                  <div className="bg-purple-500 transition-all" style={{ width: `${(sQa / sTotal) * 100}%` }} />
                  <div className="bg-green-500 transition-all" style={{ width: `${(sProd / sTotal) * 100}%` }} />
                </>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-blue-600 font-medium">{sDev} Dev</span>
                <span className="text-purple-600 font-medium">{sQa} QA</span>
                <span className="text-green-600 font-medium">{sProd} Prod</span>
                <span className="ml-auto text-gray-400 font-medium">{sTotal} PR{sTotal !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Dashboard({ prs, sprints, onSelectSprint, setSelectedPr }) {

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
                <div className="flex-1 min-w-0 overflow-hidden"><p className="text-sm font-medium text-gray-900 truncate">{pr.title}</p><p className="text-xs text-gray-400 truncate">{pr.sprint}{normalizeArray(pr.jiraTickets || pr.jiraTicket).length > 0 ? ` · ${normalizeArray(pr.jiraTickets || pr.jiraTicket)[0]}` : ''}</p></div>
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
  const [currentProject, setCurrentProject] = useState(() => { try { return localStorage.getItem(PROJECT_KEY) || '' } catch { return '' } })
  const [currentSprint, setCurrentSprint] = useState(() => { try { return localStorage.getItem(SPRINT_KEY) || '' } catch { return '' } })
  const [showForm, setShowForm] = useState(false)
  const [selectedPr, setSelectedPr] = useState(null)
  const [form, setForm] = useState({ title: '', prUrl: '', jiraTicket: '', figmaUrl: '', sprint: '', project: '' })
  const [showSprintPicker, setShowSprintPicker] = useState(false)
  const [showFormSprintPicker, setShowFormSprintPicker] = useState(false)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [storedProjects, setStoredProjects] = useState(() => { try { return JSON.parse(localStorage.getItem(PROJECTS_LIST_KEY)) || [] } catch { return [] } })
  const [draggedPr, setDraggedPr] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  const [supabaseConnected, setSupabaseConnected] = useState(hasCredentials())
  const [showDbModal, setShowDbModal] = useState(false)
  const [dbUrl, setDbUrl] = useState('')
  const [dbKey, setDbKey] = useState('')
  const [dbStatus, setDbStatus] = useState(null)

  useEffect(() => { saveLocal(prs) }, [prs])
  useEffect(() => { localStorage.setItem(SPRINT_KEY, currentSprint) }, [currentSprint])
  useEffect(() => { localStorage.setItem(PROJECT_KEY, currentProject) }, [currentProject])
  useEffect(() => { localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(storedProjects)) }, [storedProjects])
  useEffect(() => { setForm(f => ({ ...f, sprint: currentSprint, project: currentProject })) }, [currentSprint, currentProject])

  const allProjects = [...new Set([...storedProjects, ...prs.map(p => p.project).filter(Boolean)])].sort()
  const allSprints = [...new Set(prs.filter(p => !currentProject || p.project === currentProject).map(p => p.sprint).filter(Boolean))].sort()

  useEffect(() => {
    if (hasCredentials()) {
      setSupabaseConnected(true)
      const sb = getClient()
      if (sb) {
        sb.from('prs').select('*').then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setPrs(data.map(r => {
              let prUrls, jiraTickets, figmaUrls, comments
              try { prUrls = JSON.parse(r.pr_url || '[]') } catch { prUrls = r.pr_url ? [r.pr_url] : [] }
              try { jiraTickets = JSON.parse(r.jira_ticket || '[]') } catch { jiraTickets = r.jira_ticket ? [r.jira_ticket] : [] }
              try { figmaUrls = JSON.parse(r.figma_url || '[]') } catch { figmaUrls = r.figma_url ? [r.figma_url] : [] }
              try { const p = JSON.parse(r.notes || '[]'); comments = Array.isArray(p) ? p : (r.notes ? [{ id: r.id + '-m', text: r.notes, createdAt: r.created_at }] : []) } catch { comments = r.notes ? [{ id: r.id + '-m', text: r.notes, createdAt: r.created_at }] : [] }
              return {
                id: r.id, title: r.title, prUrls, jiraTickets, figmaUrls,
                sprint: r.sprint || '', status: r.status || 'dev',
                comments, createdAt: r.created_at, statusChangedAt: r.status_changed_at || r.created_at, pausedAt: r.paused_at || undefined,
              }
            }))
          }
        })
      }
    }
  }, [])

  async function syncToSupabase(data) {
    const sb = getClient()
    if (!sb) return
    try {
      const { error: delErr } = await sb.from('prs').delete().neq('id', 'none')
      if (delErr) throw delErr
      const { error: insErr } = await sb.from('prs').insert(data.map(p => ({
        id: p.id, title: p.title,
        pr_url: JSON.stringify(normalizePrUrls(p)),
        jira_ticket: JSON.stringify(normalizeArray(p.jiraTickets || p.jiraTicket)),
        figma_url: JSON.stringify(normalizeArray(p.figmaUrls || p.figmaUrl)),
        sprint: p.sprint, status: p.status,
        notes: JSON.stringify(normalizeComments(p)), created_at: p.createdAt, status_changed_at: p.statusChangedAt, paused_at: p.pausedAt || null,
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
  }, [prs, supabaseConnected])

  async function connectSupabase() {
    let url = dbUrl.trim()
    if (!url.startsWith('http')) url = 'https://' + url
    const key = dbKey.trim()
    if (!url || !key) { setDbStatus({ type: 'error', text: 'Fill in both fields' }); return }
    setDbStatus({ type: 'loading', text: 'Connecting...' })
    saveCredentials(url, key)
    try {
      await testConnection()
      setSupabaseConnected(true)

      const sb = getClient()
      const { data: existing } = await sb.from('prs').select('*')
      if (existing && existing.length > 0) {
        const mapped = existing.map(r => {
          let prUrls, jiraTickets, figmaUrls, comments
          try { prUrls = JSON.parse(r.pr_url || '[]') } catch { prUrls = r.pr_url ? [r.pr_url] : [] }
          try { jiraTickets = JSON.parse(r.jira_ticket || '[]') } catch { jiraTickets = r.jira_ticket ? [r.jira_ticket] : [] }
          try { figmaUrls = JSON.parse(r.figma_url || '[]') } catch { figmaUrls = r.figma_url ? [r.figma_url] : [] }
          try { const p = JSON.parse(r.notes || '[]'); comments = Array.isArray(p) ? p : (r.notes ? [{ id: r.id + '-m', text: r.notes, createdAt: r.created_at }] : []) } catch { comments = r.notes ? [{ id: r.id + '-m', text: r.notes, createdAt: r.created_at }] : [] }
          return {
            id: r.id, title: r.title, prUrls, jiraTickets, figmaUrls,
            sprint: r.sprint || '', status: r.status || 'dev',
            comments, createdAt: r.created_at, statusChangedAt: r.status_changed_at || r.created_at, pausedAt: r.paused_at || undefined,
          }
        })
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
      id: generateId(), title: form.title.trim(),
      project: form.project.trim() || currentProject,
      prUrls: form.prUrl.trim() ? [form.prUrl.trim()] : [],
      jiraTickets: form.jiraTicket.trim() ? [form.jiraTicket.trim()] : [],
      figmaUrls: form.figmaUrl.trim() ? [form.figmaUrl.trim()] : [],
      sprint: form.sprint.trim() || currentSprint,
      status: 'dev', comments: [], createdAt: new Date().toISOString(),
      statusChangedAt: new Date().toISOString(),
    }
    setPrs([newPr, ...prs])
    setForm({ title: '', prUrl: '', jiraTicket: '', figmaUrl: '', sprint: currentSprint, project: currentProject })
    setShowForm(false)
  }

  function movePr(id, newStatus) {
    setPrs(prs.map(p => p.id === id ? { ...p, status: newStatus, statusChangedAt: new Date().toISOString(), pausedAt: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, status: newStatus, statusChangedAt: new Date().toISOString(), pausedAt: undefined } : prev)
  }

  function togglePause(id) {
    setPrs(prs.map(p => p.id === id ? { ...p, pausedAt: p.pausedAt ? undefined : new Date().toISOString() } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, pausedAt: prev.pausedAt ? undefined : new Date().toISOString() } : prev)
  }

  function addComment(id, text) {
    const comment = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, createdAt: new Date().toISOString() }
    setPrs(prs.map(p => p.id === id ? { ...p, comments: [...normalizeComments(p), comment], notes: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, comments: [...normalizeComments(prev), comment], notes: undefined } : prev)
  }
  function deleteComment(id, commentId) {
    setPrs(prs.map(p => p.id === id ? { ...p, comments: normalizeComments(p).filter(c => c.id !== commentId) } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, comments: normalizeComments(prev).filter(c => c.id !== commentId) } : prev)
  }
  function addPrUrl(id, prLink) {
    setPrs(prs.map(p => p.id === id ? { ...p, prUrls: [...normalizePrUrls(p), prLink], prUrl: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, prUrls: [...normalizePrUrls(prev), prLink], prUrl: undefined } : prev)
  }
  function removePrUrl(id, idx) {
    setPrs(prs.map(p => p.id === id ? { ...p, prUrls: normalizePrUrls(p).filter((_, i) => i !== idx), prUrl: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, prUrls: normalizePrUrls(prev).filter((_, i) => i !== idx), prUrl: undefined } : prev)
  }
  function updatePrUrl(id, idx, prLink) {
    setPrs(prs.map(p => p.id === id ? { ...p, prUrls: normalizePrUrls(p).map((u, i) => i === idx ? prLink : u), prUrl: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, prUrls: normalizePrUrls(prev).map((u, i) => i === idx ? prLink : u), prUrl: undefined } : prev)
  }
  function updateSprint(id, sprint) {
    setPrs(prs.map(p => p.id === id ? { ...p, sprint } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, sprint } : prev)
  }
  function updateProject(id, project) {
    setPrs(prs.map(p => p.id === id ? { ...p, project } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, project } : prev)
  }
  function addJiraTicket(id, ticket) {
    setPrs(prs.map(p => p.id === id ? { ...p, jiraTickets: [...normalizeArray(p.jiraTickets || p.jiraTicket), ticket], jiraTicket: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, jiraTickets: [...normalizeArray(prev.jiraTickets || prev.jiraTicket), ticket], jiraTicket: undefined } : prev)
  }
  function removeJiraTicket(id, idx) {
    setPrs(prs.map(p => p.id === id ? { ...p, jiraTickets: normalizeArray(p.jiraTickets || p.jiraTicket).filter((_, i) => i !== idx), jiraTicket: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, jiraTickets: normalizeArray(prev.jiraTickets || prev.jiraTicket).filter((_, i) => i !== idx), jiraTicket: undefined } : prev)
  }
  function updateJiraTicket(id, idx, ticket) {
    setPrs(prs.map(p => p.id === id ? { ...p, jiraTickets: normalizeArray(p.jiraTickets || p.jiraTicket).map((t, i) => i === idx ? ticket : t), jiraTicket: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, jiraTickets: normalizeArray(prev.jiraTickets || prev.jiraTicket).map((t, i) => i === idx ? ticket : t), jiraTicket: undefined } : prev)
  }
  function addFigmaUrl(id, url) {
    setPrs(prs.map(p => p.id === id ? { ...p, figmaUrls: [...normalizeArray(p.figmaUrls || p.figmaUrl), url], figmaUrl: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, figmaUrls: [...normalizeArray(prev.figmaUrls || prev.figmaUrl), url], figmaUrl: undefined } : prev)
  }
  function removeFigmaUrl(id, idx) {
    setPrs(prs.map(p => p.id === id ? { ...p, figmaUrls: normalizeArray(p.figmaUrls || p.figmaUrl).filter((_, i) => i !== idx), figmaUrl: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, figmaUrls: normalizeArray(prev.figmaUrls || prev.figmaUrl).filter((_, i) => i !== idx), figmaUrl: undefined } : prev)
  }
  function updateFigmaUrl(id, idx, url) {
    setPrs(prs.map(p => p.id === id ? { ...p, figmaUrls: normalizeArray(p.figmaUrls || p.figmaUrl).map((u, i) => i === idx ? url : u), figmaUrl: undefined } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, figmaUrls: normalizeArray(prev.figmaUrls || prev.figmaUrl).map((u, i) => i === idx ? url : u), figmaUrl: undefined } : prev)
  }
  function updateTitle(id, title) {
    setPrs(prs.map(p => p.id === id ? { ...p, title } : p))
    setSelectedPr(prev => prev?.id === id ? { ...prev, title } : prev)
  }
  function deletePr(id) { setPrs(prs.filter(p => p.id !== id)) }
  function getColumnPrs(status) { return prs.filter(p => p.status === status && p.sprint === currentSprint && (p.project === currentProject || !p.project)) }

  function handleDragStart(pr) {
    setDraggedPr(pr)
  }

  function handleDragOver(e, colId) {
    e.preventDefault()
    setDragOverCol(colId)
  }

  function handleDrop(e, colId) {
    e.preventDefault()
    if (draggedPr && draggedPr.status !== colId) {
      movePr(draggedPr.id, colId)
    }
    setDraggedPr(null)
    setDragOverCol(null)
  }

  function createProject(name) {
    if (!storedProjects.includes(name)) setStoredProjects(prev => [...prev, name].sort())
    setCurrentProject(name)
    setCurrentSprint('')
  }

  function deleteProject(name) {
    setStoredProjects(prev => prev.filter(p => p !== name))
    if (currentProject === name) { setCurrentProject(''); setCurrentSprint('') }
  }

  function handleDragEnd() {
    setDraggedPr(null)
    setDragOverCol(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Sidebar ── */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">PR Tracker</h1>
          {supabaseConnected && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium mt-1.5 inline-block">Synced</span>}
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Projects</p>
          {allProjects.length === 0 && <p className="text-xs text-gray-400 px-3 italic">No projects yet</p>}
          {allProjects.map(project => (
            <div key={project} className="group relative flex items-center">
              <button onClick={() => { setCurrentProject(project); setCurrentSprint('') }}
                className={`flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors cursor-pointer ${currentProject === project ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                {project}
              </button>
              <button onClick={e => { e.stopPropagation(); deleteProject(project) }}
                className="opacity-0 group-hover:opacity-100 absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-opacity cursor-pointer"
                title="Delete project">
                <XIconSmall />
              </button>
            </div>
          ))}
        </div>

        <div className="px-2 py-3 border-t border-gray-100 space-y-1">
          {showProjectForm ? (
            <div className="px-1 pb-1">
              <input autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newProjectName.trim()) { createProject(newProjectName.trim()); setNewProjectName(''); setShowProjectForm(false) }; if (e.key === 'Escape') { setShowProjectForm(false); setNewProjectName('') } }}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none mb-1.5" placeholder="Project name…" />
              <div className="flex gap-1">
                <button onClick={() => { if (newProjectName.trim()) { createProject(newProjectName.trim()); setNewProjectName(''); setShowProjectForm(false) } }} className="flex-1 text-xs py-1.5 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 font-medium">Create</button>
                <button onClick={() => { setShowProjectForm(false); setNewProjectName('') }} className="flex-1 text-xs py-1.5 border border-gray-300 text-gray-600 rounded-lg cursor-pointer hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowProjectForm(true)} className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 font-medium cursor-pointer">+ New Project</button>
          )}
          <button onClick={() => { setDbUrl(''); setDbKey(''); setDbStatus(null); setShowDbModal(true) }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 cursor-pointer">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
            Database
            {supabaseConnected && <span className="ml-auto w-2 h-2 rounded-full bg-green-500 shrink-0" />}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="ml-56 flex-1 min-h-screen flex flex-col">

        {/* Top bar */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-20 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {currentProject ? (
              <>
                <span className="font-semibold text-gray-800">{currentProject}</span>
                <div className="relative">
                  <button onClick={() => setShowSprintPicker(!showSprintPicker)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer">
                    {currentSprint || 'All Sprints'}
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showSprintPicker && (
                    <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-gray-100">
                        <input type="text" placeholder="+ New sprint..." className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { setCurrentSprint(e.target.value.trim()); setShowSprintPicker(false) } }} />
                      </div>
                      <button onClick={() => { setCurrentSprint(''); setShowSprintPicker(false) }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!currentSprint ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>All Sprints</button>
                      {allSprints.map(s => (
                        <button key={s} onClick={() => { setCurrentSprint(s); setShowSprintPicker(false) }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${currentSprint === s ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <span className="text-sm text-gray-400">Select a project from the sidebar</span>
            )}
          </div>
          {currentProject && <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors cursor-pointer shrink-0">+ Add PR</button>}
        </div>

        {/* Page content */}
        <div className="flex-1 p-6">
          {currentSprint && currentProject && (
            <div className="mb-4"><button onClick={() => setCurrentSprint('')} className="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer">← {currentProject}</button></div>
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
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3"><p className="text-sm text-green-800 font-medium">Connected to Supabase</p></div>
                    <p className="text-sm text-gray-500">All changes are automatically synced to the database.</p>
                    <button onClick={disconnectSupabase} className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors cursor-pointer">Disconnect</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Enter your Supabase project credentials (Settings → API).</p>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Project URL</label><input type="text" value={dbUrl} onChange={e => setDbUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="https://xxxxx.supabase.co" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">anon / public key</label><input type="text" value={dbKey} onChange={e => setDbKey(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="eyJhbGciOiJIUzI1NiIs..." /></div>
                    {dbStatus && <div className={`text-sm px-3 py-2 rounded-lg ${dbStatus.type === 'error' ? 'bg-red-50 text-red-700' : dbStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{dbStatus.text}</div>}
                    <button onClick={connectSupabase} disabled={!dbUrl || !dbKey} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors cursor-pointer">Connect</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          {!currentProject ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">No project selected</h2>
              <p className="text-sm text-gray-400 mb-5">Pick a project from the sidebar or create a new one</p>
              <button onClick={() => setShowProjectForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium cursor-pointer">+ New Project</button>
            </div>
          ) : currentSprint ? (
            <>
              <div className="mb-4 text-sm text-gray-500">Showing <span className="font-medium text-gray-700">{currentSprint}</span> · {prs.filter(p => p.sprint === currentSprint && (p.project === currentProject || !p.project)).length} PRs</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {(() => {
                  const sprintPrs = prs.filter(p => p.sprint === currentSprint && (p.project === currentProject || !p.project))
                  return (
                    <>
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><p className="text-sm text-gray-500 font-medium">Total PRs</p><p className="text-2xl font-bold text-gray-900 mt-0.5">{sprintPrs.length}</p></div>
                      <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><p className="text-sm text-gray-500 font-medium">In Dev</p></div><p className="text-2xl font-bold text-blue-600 mt-0.5">{sprintPrs.filter(p => p.status === 'dev').length}</p></div>
                      <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-4"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-purple-500" /><p className="text-sm text-gray-500 font-medium">In QA</p></div><p className="text-2xl font-bold text-purple-600 mt-0.5">{sprintPrs.filter(p => p.status === 'qa').length}</p></div>
                      <div className="bg-white rounded-xl shadow-sm border border-green-200 p-4"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><p className="text-sm text-gray-500 font-medium">In Prod</p></div><p className="text-2xl font-bold text-green-600 mt-0.5">{sprintPrs.filter(p => p.status === 'prod').length}</p></div>
                    </>
                  )
                })()}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {COLUMNS.map(col => {
                  const columnPrs = getColumnPrs(col.id)
                  const isOver = dragOverCol === col.id
                  return (
                    <div key={col.id} onDragOver={e => handleDragOver(e, col.id)} onDragLeave={() => setDragOverCol(null)} onDrop={e => handleDrop(e, col.id)}
                      className={`bg-gray-100 rounded-xl p-4 min-h-[300px] transition-shadow ${isOver ? 'shadow-inner ring-2 ring-indigo-400 ring-dashed' : ''}`}>
                      <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-lg border-2 ${col.color}`}>
                        <h3 className="font-semibold text-gray-800">{col.label}</h3>
                        <span className="text-sm font-medium text-gray-500 bg-white/60 px-2 py-0.5 rounded-full">{columnPrs.length}</span>
                      </div>
                      <div className="space-y-2">
                        {columnPrs.map(pr => {
                          const prUrls = normalizePrUrls(pr)
                          const jiraTickets = normalizeArray(pr.jiraTickets || pr.jiraTicket)
                          const figmaUrls = normalizeArray(pr.figmaUrls || pr.figmaUrl)
                          const visiblePrUrls = prUrls.slice(0, 3)
                          const extraPrCount = prUrls.length - 3
                          const visibleJiraTickets = jiraTickets.slice(0, 2)
                          const extraJiraCount = jiraTickets.length - 2
                          const visibleFigmaUrls = figmaUrls.slice(0, 2)
                          const extraFigmaCount = figmaUrls.length - 2
                          const commentCount = normalizeComments(pr).length
                          return (
                            <div key={pr.id} draggable onDragStart={() => handleDragStart(pr)} onDragEnd={handleDragEnd} onClick={() => setSelectedPr(pr)}
                              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md hover:border-gray-300 transition-all cursor-grab active:cursor-grabbing overflow-hidden ${draggedPr?.id === pr.id ? 'opacity-50' : ''}`}>
                              <div className="flex items-center flex-wrap gap-1.5 mb-1.5 min-w-0">
                                {visibleJiraTickets.map((jt, i) => <span key={i} className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded truncate max-w-full">{jt}</span>)}
                                {extraJiraCount > 0 && <span className="text-xs text-purple-400">+{extraJiraCount}</span>}
                                {visibleFigmaUrls.map((_, i) => <span key={i} className="text-xs text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded shrink-0">figma</span>)}
                                {extraFigmaCount > 0 && <span className="text-xs text-pink-400">+{extraFigmaCount}</span>}
                              </div>
                              <h4 className="font-medium text-gray-900 text-sm leading-snug truncate">{pr.title}</h4>
                              <div className="flex items-center flex-wrap gap-1 mt-1">
                                {visiblePrUrls.map((prLink, i) => <span key={i} className="text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded truncate">{prLink.name}</span>)}
                                {extraPrCount > 0 && <span className="text-xs text-indigo-400">+{extraPrCount} more</span>}
                              </div>
                              <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                <span className="text-xs text-gray-400 shrink-0">{new Date(pr.createdAt).toLocaleDateString()}</span>
                                {pr.statusChangedAt && <span className={`text-xs font-medium ${ageColor(ageTimestamp(pr))} ${pr.pausedAt ? 'line-through' : ''}`}>{timeAgo(ageTimestamp(pr))}</span>}
                                {pr.pausedAt && <span className="text-xs text-amber-500">⏸</span>}
                                {commentCount > 0 && <span className="text-xs text-gray-400">· {commentCount} comment{commentCount !== 1 ? 's' : ''}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <Dashboard prs={prs.filter(p => p.project === currentProject || !p.project)} sprints={allSprints} onSelectSprint={setCurrentSprint} setSelectedPr={setSelectedPr} />
          )}
        </div>
      </div>

      {selectedPr && (
        <CardModal pr={selectedPr} onClose={() => setSelectedPr(null)} onMove={movePr} onDelete={deletePr} onAddComment={addComment} onDeleteComment={deleteComment} onUpdateSprint={updateSprint} onUpdateProject={updateProject} onAddPrUrl={addPrUrl} onRemovePrUrl={removePrUrl} onUpdatePrUrl={updatePrUrl} onAddJiraTicket={addJiraTicket} onRemoveJiraTicket={removeJiraTicket} onUpdateJiraTicket={updateJiraTicket} onAddFigmaUrl={addFigmaUrl} onRemoveFigmaUrl={removeFigmaUrl} onUpdateFigmaUrl={updateFigmaUrl} onUpdateTitle={updateTitle} onTogglePause={togglePause} allSprints={allSprints} allProjects={allProjects} />
      )}
    </div>
  )
}
