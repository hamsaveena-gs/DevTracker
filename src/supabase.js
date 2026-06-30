import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL_KEY = 'pr-tracker-supabase-url'
const SUPABASE_KEY_KEY = 'pr-tracker-supabase-key'

let client = null

function getStoredCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const lsUrl = localStorage.getItem(SUPABASE_URL_KEY)
  const lsKey = localStorage.getItem(SUPABASE_KEY_KEY)

  if (envUrl && envKey) return { url: envUrl, key: envKey }
  if (lsUrl && lsKey) return { url: lsUrl, key: lsKey }
  return null
}

export function getClient() {
  if (client) return client
  const creds = getStoredCredentials()
  if (!creds) return null
  client = createClient(creds.url, creds.key)
  return client
}

export function saveCredentials(url, key) {
  localStorage.setItem(SUPABASE_URL_KEY, url)
  localStorage.setItem(SUPABASE_KEY_KEY, key)
  client = null
}

export function clearCredentials() {
  localStorage.removeItem(SUPABASE_URL_KEY)
  localStorage.removeItem(SUPABASE_KEY_KEY)
  client = null
}

export function hasCredentials() {
  return !!getStoredCredentials()
}

export async function testConnection() {
  const sb = getClient()
  if (!sb) throw new Error('Not connected')

  const { data, error } = await sb.from('prs').select('id', { count: 'exact', head: true })

  if (error) {
    if (error.code === '42P01') {
      throw new Error('Table "prs" does not exist. Run this in Supabase SQL Editor:\n\nCREATE TABLE prs (\n  id TEXT PRIMARY KEY,\n  title TEXT NOT NULL,\n  pr_url TEXT,\n  jira_ticket TEXT,\n  figma_url TEXT,\n  sprint TEXT,\n  status TEXT DEFAULT \'dev\',\n  notes TEXT DEFAULT \'\',\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  status_changed_at TIMESTAMPTZ DEFAULT NOW()\n);')
    }
    throw new Error(error.message || 'Connection failed. Check URL and anon key.')
  }
  return true
}
