import Project from '#models/project'
import AuthorizationService from '#services/authorization_service'

interface TreeNode {
  id: string
  name: string
  type: 'folder' | 'note'
  noteId?: string
  children?: TreeNode[]
  order?: number
}

interface CreateProjectData {
  name: string
  description?: string | null
  color?: string | null
  userId: string
}

interface ProjectWithTree {
  id: string
  name: string
  description: string | null
  color: string | null
  userId: string
  folderTree: TreeNode
  createdAt: Date
  updatedAt: Date
}

export default class ProjectService {
  private authService: AuthorizationService

  constructor() {
    this.authService = new AuthorizationService()
  }

  /**
   * Initialize empty folder tree structure
   */
  initializeFolderTree(): TreeNode {
    return {
      id: 'root',
      name: 'Root',
      type: 'folder',
      children: [],
    }
  }

  /**
   * Find a node in the tree by path
   */
  findNodeByPath(tree: TreeNode, path: string[]): TreeNode | null {
    if (!path || path.length === 0) return tree

    let current = tree
    for (const folderId of path) {
      const child = current.children?.find((node) => node.id === folderId && node.type === 'folder')
      if (!child) return null
      current = child
    }
    return current
  }

  /**
   * Add a node to the tree at the specified path
   */
  addNodeToTree(tree: TreeNode, node: TreeNode, path: string[]): boolean {
    const parent = this.findNodeByPath(tree, path)
    if (!parent) return false

    if (!parent.children) parent.children = []

    // Assign order based on current children length
    node.order = parent.children.length

    parent.children.push(node)
    return true
  }

  /**
   * Remove a node from the tree by ID (for folders and notes)
   */
  removeNodeById(tree: TreeNode, nodeId: string): boolean {
    if (!tree.children) return false

    // Check direct children
    const index = tree.children.findIndex((child) => child.id === nodeId)
    if (index !== -1) {
      tree.children.splice(index, 1)
      return true
    }

    // Recursively check folders
    for (const child of tree.children) {
      if (child.type === 'folder' && this.removeNodeById(child, nodeId)) {
        return true
      }
    }

    return false
  }

  /**
   * Remove a note from the tree by noteId
   */
  removeNoteFromTree(tree: TreeNode, noteId: string): boolean {
    if (!tree.children) return false

    // Check direct children
    const index = tree.children.findIndex(
      (child) => child.type === 'note' && child.noteId === noteId
    )

    if (index !== -1) {
      tree.children.splice(index, 1)
      return true
    }

    // Recursively check folders
    for (const child of tree.children) {
      if (child.type === 'folder' && this.removeNoteFromTree(child, noteId)) {
        return true
      }
    }

    return false
  }

  /**
   * Update note name in the tree
   */
  updateNoteInTree(tree: TreeNode, noteId: string, newName: string): boolean {
    if (!tree.children) return false

    // Check direct children
    for (const child of tree.children) {
      if (child.type === 'note' && child.noteId === noteId) {
        child.name = newName
        return true
      }
    }

    // Recursively check folders
    for (const child of tree.children) {
      if (child.type === 'folder' && this.updateNoteInTree(child, noteId, newName)) {
        return true
      }
    }

    return false
  }

  /**
   * Find a node by ID in the tree (returns the node and its parent)
   */
  findNodeById(
    tree: TreeNode,
    nodeId: string,
    parent: TreeNode | null = null
  ): { node: TreeNode; parent: TreeNode | null } | null {
    if (tree.id === nodeId) {
      return { node: tree, parent }
    }

    if (!tree.children) return null

    for (const child of tree.children) {
      if (child.id === nodeId) {
        return { node: child, parent: tree }
      }

      if (child.type === 'folder') {
        const result = this.findNodeById(child, nodeId, tree)
        if (result) return result
      }
    }

    return null
  }

  /**
   * Check if a node is a descendant of another node
   */
  isDescendant(tree: TreeNode, ancestorId: string, descendantId: string): boolean {
    if (tree.id === descendantId) return false
    if (tree.id === ancestorId) {
      return this.findNodeById(tree, descendantId) !== null
    }

    if (!tree.children) return false

    for (const child of tree.children) {
      if (this.isDescendant(child, ancestorId, descendantId)) {
        return true
      }
    }

    return false
  }

  /**
   * Move a node to a new parent and position
   */
  moveNodeInTree(
    tree: TreeNode,
    nodeId: string,
    newParentId: string,
    newIndex: number
  ): boolean {
    // Prevent moving root
    if (nodeId === 'root') return false

    // Find the node and its current parent
    const nodeResult = this.findNodeById(tree, nodeId)
    if (!nodeResult) return false

    const { node, parent: oldParent } = nodeResult

    // Find the new parent
    const newParentResult = this.findNodeById(tree, newParentId)
    if (!newParentResult) return false

    const { node: newParent } = newParentResult

    // Ensure new parent is a folder
    if (newParent.type !== 'folder') return false

    // Prevent moving a folder into itself or its descendants
    if (node.type === 'folder' && this.isDescendant(tree, nodeId, newParentId)) {
      return false
    }

    // Remove from old parent
    if (oldParent && oldParent.children) {
      const oldIndex = oldParent.children.findIndex((child) => child.id === nodeId)
      if (oldIndex !== -1) {
        oldParent.children.splice(oldIndex, 1)
        // Reorder remaining children
        oldParent.children.forEach((child, idx) => {
          child.order = idx
        })
      }
    }

    // Add to new parent at specified index
    if (!newParent.children) newParent.children = []

    const insertIndex = Math.min(newIndex, newParent.children.length)
    newParent.children.splice(insertIndex, 0, node)

    // Reorder all children in new parent
    newParent.children.forEach((child, idx) => {
      child.order = idx
    })

    return true
  }

  /**
   * Reorder children within a parent node
   */
  reorderChildrenInTree(tree: TreeNode, parentId: string, childIds: string[]): boolean {
    // Find the parent node
    const parentResult = this.findNodeById(tree, parentId)
    if (!parentResult) return false

    const { node: parent } = parentResult

    if (!parent.children || parent.children.length === 0) return false

    // Verify all child IDs exist and belong to this parent
    const currentChildIds = parent.children.map((c) => c.id)
    if (
      childIds.length !== currentChildIds.length ||
      !childIds.every((id) => currentChildIds.includes(id))
    ) {
      return false
    }

    // Create a map for quick lookup
    const childMap = new Map(parent.children.map((child) => [child.id, child]))

    // Reorder children based on provided order
    parent.children = childIds.map((id, index) => {
      const child = childMap.get(id)!
      child.order = index
      return child
    })

    return true
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectData): Promise<Project> {
    const project = await Project.create({
      name: data.name,
      description: data.description || null,
      color: data.color || null,
      userId: data.userId,
      folderTree: this.initializeFolderTree() as any,
    })

    return project
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<Project[]> {
    const projects = await Project.query()
      .where('userId', userId)
      .whereNull('deletedAt')
      .orderBy('createdAt', 'desc')

    return projects
  }

  /**
   * Get project by ID with authorization check
   */
  async getProjectById(userId: string, projectId: string): Promise<Project> {
    return await this.authService.getProjectForUser(userId, projectId)
  }

  /**
   * Get all notes for a specific project
   */
  async getProjectNotes(userId: string, projectId: string): Promise<any[]> {
    // First verify user has access to the project
    await this.authService.getProjectForUser(userId, projectId)

    // Import Note model dynamically to avoid circular dependency
    const { default: Note } = await import('#models/note')

    const notes = await Note.query()
      .where('projectId', projectId)
      .where('userId', userId)
      .whereNot('name', '__LIBRARY_ITEMS_SYSTEM__') // Exclude system note
      .orderBy('createdAt', 'desc')

    return notes
  }

  /**
   * Get note summaries for a specific project (lightweight - only id, name, createdAt)
   */
  async getProjectNotesSummary(userId: string, projectId: string): Promise<any[]> {
    // First verify user has access to the project
    await this.authService.getProjectForUser(userId, projectId)

    // Import Note model dynamically to avoid circular dependency
    const { default: Note } = await import('#models/note')

    const notesSummary = await Note.query()
      .select('id', 'name', 'createdAt')
      .where('projectId', projectId)
      .where('userId', userId)
      .whereNot('name', '__LIBRARY_ITEMS_SYSTEM__') // Exclude system note
      .orderBy('createdAt', 'desc')

    return notesSummary
  }

  /**
   * Get project with preloaded relationships
   */
  async getProjectWithRelations(userId: string, projectId: string): Promise<Project> {
    const project = await Project.query()
      .where('id', projectId)
      .where('userId', userId)
      .whereNull('deletedAt')
      .preload('libraryItems')
      .first()

    if (!project) {
      throw new Error('Project not found or you do not have access to it')
    }

    return project
  }

  /**
   * Get project tree structure
   */
  async getProjectTree(userId: string, projectId: string): Promise<ProjectWithTree> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    const folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

    return {
      id: project.id,
      name: project.name,
      description: project.description || null,
      color: project.color || null,
      userId: project.userId,
      folderTree: folderTree,
      createdAt: project.createdAt.toJSDate(),
      updatedAt: project.updatedAt.toJSDate(),
    }
  }

  /**
   * Add folder to project tree
   */
  async addFolderToTree(
    userId: string,
    projectId: string,
    folderName: string,
    folderPath: string[] = []
  ): Promise<{ project: Project; folderNode: TreeNode }> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

    const folderNode: TreeNode = {
      id: crypto.randomUUID(),
      name: folderName,
      type: 'folder',
      children: [],
    }

    const added = this.addNodeToTree(folderTree, folderNode, folderPath)

    if (!added) {
      // If we couldn't add to the specified path, add to root
      folderTree.children = folderTree.children || []
      folderTree.children.push(folderNode)
    }

    await project.merge({ folderTree: folderTree as any }).save()

    return { project, folderNode }
  }

  /**
   * Add note to project tree
   */
  async addNoteToTree(
    userId: string,
    projectId: string,
    noteId: string,
    noteName: string,
    folderPath: string[] = []
  ): Promise<{ project: Project; noteNode: TreeNode }> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

    const noteNode: TreeNode = {
      id: crypto.randomUUID(),
      name: noteName,
      type: 'note',
      noteId: noteId,
    }

    const added = this.addNodeToTree(folderTree, noteNode, folderPath)

    if (!added) {
      // If we couldn't add to the specified path, add to root
      folderTree.children = folderTree.children || []
      folderTree.children.push(noteNode)
    }

    await project.merge({ folderTree: folderTree as any }).save()

    return { project, noteNode }
  }

  /**
   * Remove folder from project tree
   */
  async removeFolderFromTree(
    userId: string,
    projectId: string,
    folderId: string
  ): Promise<Project> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

    const removed = this.removeNodeById(folderTree, folderId)

    if (!removed) {
      throw new Error('Folder not found in the project tree')
    }

    await project.merge({ folderTree: folderTree as any }).save()

    return project
  }

  /**
   * Update note name in project tree
   */
  async updateNoteNameInTree(
    userId: string,
    projectId: string,
    noteId: string,
    newName: string
  ): Promise<Project> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

    this.updateNoteInTree(folderTree, noteId, newName)

    await project.merge({ folderTree: folderTree as any }).save()

    return project
  }

  /**
   * Remove note from project tree
   */
  async removeNoteFromProjectTree(
    userId: string,
    projectId: string,
    noteId: string
  ): Promise<Project> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

    this.removeNoteFromTree(folderTree, noteId)

    await project.merge({ folderTree: folderTree as any }).save()

    return project
  }

  /**
   * Get optimized tools data for a project - only counts and basic info
   */
  async getProjectToolsData(userId: string, projectId: string) {
    const project = await this.authService.getProjectForUser(userId, projectId)

    // Import models dynamically to avoid circular dependencies
    const Note = (await import('#models/note')).default
    const LibraryItem = (await import('#models/library_item')).default
    const FlashcardSet = (await import('#models/flashcard_set')).default
    const MultipleChoiceSet = (await import('#models/multiple_choice_set')).default

    // Get counts only - much faster than loading full data
    const [notesCount, libraryItemsCount, flashcardSetsCount, multipleChoiceSetsCount] =
      await Promise.all([
        Note.query().where('project_id', projectId).where('user_id', userId).count('* as total'),
        LibraryItem.query()
          .where((query) => {
            query.where('project_id', projectId).orWhere('is_global', true)
          })
          .count('* as total'),
        FlashcardSet.query()
          .where('project_id', projectId)
          .where('user_id', userId)
          .count('* as total'),
        MultipleChoiceSet.query()
          .where('project_id', projectId)
          .where('user_id', userId)
          .count('* as total'),
      ])

    // Get a few recent notes for the selector (limit to 20 for performance)
    const recentNotes = await Note.query()
      .where('project_id', projectId)
      .where('user_id', userId)
      .whereNot('name', '__LIBRARY_ITEMS_SYSTEM__') // Exclude system note
      .select('id', 'name', 'content')
      .orderBy('updated_at', 'desc')
      .limit(20)

    // Get a few recent library items for the selector (limit to 20 for performance)
    const recentLibraryItems = await LibraryItem.query()
      .where((query) => {
        query.where('project_id', projectId).orWhere('is_global', true)
      })
      .select('id', 'name', 'type', 'size')
      .orderBy('updated_at', 'desc')
      .limit(20)

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      counts: {
        notes: Number.parseInt(notesCount[0].$extras.total),
        libraryItems: Number.parseInt(libraryItemsCount[0].$extras.total),
        flashcardSets: Number.parseInt(flashcardSetsCount[0].$extras.total),
        multipleChoiceSets: Number.parseInt(multipleChoiceSetsCount[0].$extras.total),
      },
      recentNotes: recentNotes.map((note) => ({
        id: note.id,
        name: note.name,
        hasContent: note.content ? note.content.trim().length > 0 : false,
      })),
      recentLibraryItems: recentLibraryItems.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.mimeType,
        size: item.size,
      })),
    }
  }

  /**
   * Update project details (name, description, color)
   */
  async updateProject(
    userId: string,
    projectId: string,
    data: { name?: string; description?: string | null; color?: string | null }
  ): Promise<Project> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    await project.merge(data).save()

    return project
  }

  /**
   * Delete a project and cascade delete all associated data
   * This includes notes, flashcard sets, multiple choice sets, library items, etc.
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    // Verify authorization first (throws if user doesn't have access)
    await this.authService.getProjectForUser(userId, projectId)

    // Import database service for transactions
    const db = (await import('@adonisjs/lucid/services/db')).default

    // Use transaction to ensure all-or-nothing deletion
    await db.transaction(async (trx) => {
      // 1. Delete vector chunks for notes and library items in this project
      await trx
        .from('vector_chunks')
        .whereIn('note_id', trx.from('notes').select('id').where('project_id', projectId))
        .delete()

      await trx
        .from('vector_chunks')
        .whereIn(
          'library_item_id',
          trx.from('library_items').select('id').where('project_id', projectId)
        )
        .delete()

      // 2. Delete pivot table entries
      await trx.from('project_starred_flashcards').where('project_id', projectId).delete()

      await trx
        .from('project_starred_multiple_choice_questions')
        .where('project_id', projectId)
        .delete()

      await trx
        .from('flashcard_set_notes')
        .whereIn(
          'flashcard_set_id',
          trx.from('flashcard_sets').select('id').where('project_id', projectId)
        )
        .delete()

      await trx
        .from('flashcard_set_library_items')
        .whereIn(
          'flashcard_set_id',
          trx.from('flashcard_sets').select('id').where('project_id', projectId)
        )
        .delete()

      await trx
        .from('multiple_choice_set_notes')
        .whereIn(
          'multiple_choice_set_id',
          trx.from('multiple_choice_sets').select('id').where('project_id', projectId)
        )
        .delete()

      await trx
        .from('multiple_choice_set_library_items')
        .whereIn(
          'multiple_choice_set_id',
          trx.from('multiple_choice_sets').select('id').where('project_id', projectId)
        )
        .delete()

      // Free response sets pivot tables (if they exist)
      const hasFreeResponseTables = await trx.schema.hasTable('free_response_sets')
      if (hasFreeResponseTables) {
        await trx
          .from('free_response_set_notes')
          .whereIn(
            'free_response_set_id',
            trx.from('free_response_sets').select('id').where('project_id', projectId)
          )
          .delete()

        await trx
          .from('free_response_set_library_items')
          .whereIn(
            'free_response_set_id',
            trx.from('free_response_sets').select('id').where('project_id', projectId)
          )
          .delete()
      }

      // Note library items pivot
      await trx
        .from('note_library_items')
        .whereIn('note_id', trx.from('notes').select('id').where('project_id', projectId))
        .delete()

      // Flashcard library items pivot
      await trx
        .from('flashcard_library_items')
        .whereIn(
          'flashcard_id',
          trx.from('flashcards').select('id').where('project_id', projectId)
        )
        .delete()

      // 3. Delete free response evaluations, questions, and sets
      if (hasFreeResponseTables) {
        await trx
          .from('free_response_evaluations')
          .whereIn(
            'free_response_id',
            trx
              .from('free_responses')
              .select('id')
              .whereIn(
                'free_response_set_id',
                trx.from('free_response_sets').select('id').where('project_id', projectId)
              )
          )
          .delete()

        await trx
          .from('free_responses')
          .whereIn(
            'free_response_set_id',
            trx.from('free_response_sets').select('id').where('project_id', projectId)
          )
          .delete()

        await trx.from('free_response_sets').where('project_id', projectId).delete()
      }

      // 4. Delete multiple choice questions and sets
      await trx
        .from('multiple_choice_questions')
        .whereIn(
          'multiple_choice_set_id',
          trx.from('multiple_choice_sets').select('id').where('project_id', projectId)
        )
        .delete()

      await trx.from('multiple_choice_sets').where('project_id', projectId).delete()

      // 5. Delete flashcards and flashcard sets
      await trx.from('flashcards').where('project_id', projectId).delete()

      await trx.from('flashcard_sets').where('project_id', projectId).delete()

      // 6. Delete study options for notes
      await trx
        .from('study_options')
        .whereIn('note_id', trx.from('notes').select('id').where('project_id', projectId))
        .delete()

      // 7. Delete library items (project-specific only, not global)
      await trx.from('library_items').where('project_id', projectId).delete()

      // 8. Delete notes
      await trx.from('notes').where('project_id', projectId).delete()

      // 9. Delete todos (if table exists and has project_id)
      const hasTodosTable = await trx.schema.hasTable('todos')
      if (hasTodosTable) {
        const hasTodosProjectId = await trx.schema.hasColumn('todos', 'project_id')
        if (hasTodosProjectId) {
          await trx.from('todos').where('project_id', projectId).delete()
        }
      }

      // 12. Finally, soft delete the project itself
      await trx.from('projects').where('id', projectId).update({
        deleted_at: new Date(),
      })
    })

    console.log(`✅ Project ${projectId} and all associated data deleted successfully`)
  }

  /**
   * Move a node to a different location in the tree
   */
  async moveNode(
    userId: string,
    projectId: string,
    nodeId: string,
    newParentId: string,
    newIndex: number
  ): Promise<Project> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

    const success = this.moveNodeInTree(folderTree, nodeId, newParentId, newIndex)

    if (!success) {
      throw new Error('Failed to move node. Invalid operation.')
    }

    await project.merge({ folderTree: folderTree as any }).save()

    return project
  }

  /**
   * Reorder children within a parent node
   */
  async reorderNodes(
    userId: string,
    projectId: string,
    parentId: string,
    childIds: string[]
  ): Promise<Project> {
    const project = await this.authService.getProjectForUser(userId, projectId)

    let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

    const success = this.reorderChildrenInTree(folderTree, parentId, childIds)

    if (!success) {
      throw new Error('Failed to reorder nodes. Invalid operation.')
    }

    await project.merge({ folderTree: folderTree as any }).save()

    return project
  }
}
