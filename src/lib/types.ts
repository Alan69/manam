export interface Person {
  id: number
  full_name: string
  father_id: number | null
  generation: number | null
  birth_year: number | null
  death_year: number | null
  is_alive: boolean
  bio: string | null
  photo_url: string | null
  residence: string | null
  is_verified: boolean
}

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  role: 'user' | 'moderator' | 'admin'
  person_id: number | null
}

export interface PersonPayload {
  full_name?: string
  father_id?: number | null
  birth_year?: number | null
  death_year?: number | null
  is_alive?: boolean
  bio?: string
  residence?: string
  photo_url?: string
}

export interface Submission {
  id: number
  submitted_by: string
  type: 'add_person' | 'edit_person' | 'link_self'
  target_person_id: number | null
  payload: PersonPayload
  status: 'pending' | 'approved' | 'rejected'
  moderator_comment: string | null
  created_at: string
}
