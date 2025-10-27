/**
 * Note Types
 * Types related to notes and note operations
 */

export interface CreateNoteData {
  projectId: string
  name: string
  content?: string
  folderPath?: string[]
  userId: string
}

export interface UpdateNoteData {
  name?: string
  content?: string
}

export interface StudyOptionsData {
  flashcard?: 'queued' | 'completed' | 'failed' | null
  blurtItOut?: 'queued' | 'completed' | 'failed' | null
  multipleChoice?: 'queued' | 'completed' | 'failed' | null
  fillInTheBlank?: 'queued' | 'completed' | 'failed' | null
  matching?: 'queued' | 'completed' | 'failed' | null
  shortAnswer?: 'queued' | 'completed' | 'failed' | null
  essay?: 'queued' | 'completed' | 'failed' | null
}
