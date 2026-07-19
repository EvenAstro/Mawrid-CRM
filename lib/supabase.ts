import { createBrowserClient } from '@supabase/ssr'

export const SUPABASE_URL = 'https://ctibusjfvbffdlmzkqxh.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aWJ1c2pmdmJmZmRsbXprcXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTU5ODksImV4cCI6MjA5ODk5MTk4OX0.wpZk7MyWh4XKR8DZmd2nIFXCVvYvzm6MNXqld4T49wI'

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
