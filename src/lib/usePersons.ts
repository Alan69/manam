import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Person } from './types'

// Одним запросом тянем всё древо (для шежіре в сотни-тысячи узлов — нормально).
export function usePersons() {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const { data, error } = await supabase
      .from('persons')
      .select('id, full_name, father_id, generation, birth_year, death_year, is_alive, bio, photo_url, residence, is_verified')
      .order('generation')
    if (error) setError(error.message)
    else setPersons((data as Person[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  return { persons, loading, error, reload }
}
