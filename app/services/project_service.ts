import Project from '#models/project'
import AuthorizationService from '#services/authorization_service'

interface TreeNode {
  id: string
  name: string
  type: 'folder' | 'note'
  noteId?: string
  children?: TreeNode[]
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
      .preload('workflows')
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
}
