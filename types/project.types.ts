/**
 * Project Types
 * Types related to projects, folder trees, and project structure
 */

export interface TreeNode {
  id: string
  name: string
  type: 'folder' | 'note'
  noteId?: string
  children?: TreeNode[]
  order?: number
}

export interface CreateProjectData {
  name: string
  description?: string | null
  color?: string | null
  userId: string
}

export interface ProjectWithTree {
  id: string
  name: string
  description: string | null
  color: string | null
  userId: string
  folderTree: TreeNode
  createdAt: Date
  updatedAt: Date
}
