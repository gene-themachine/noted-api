import type { HttpContext } from '@adonisjs/core/http'
import Note from '#models/note'
import Project from '#models/project'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import { randomUUID } from 'node:crypto'

interface TreeNode {
  id: string
  name: string
  type: 'folder' | 'note'
  noteId?: string // Only for note nodes
  children?: TreeNode[]
}

export default class NotesController {
  static createValidator = vine.compile(
    vine.object({
      projectId: vine.string().trim().minLength(1),
      name: vine.string().trim().minLength(1).maxLength(255),
      description: vine.string().trim().optional(),
      content: vine.string().trim().optional(),
      folderPath: vine.array(vine.string()).optional(), // Array of folder IDs representing the path
    })
  )

  static createFolderValidator = vine.compile(
    vine.object({
      projectId: vine.string().trim().minLength(1),
      name: vine.string().trim().minLength(1).maxLength(255),
      folderPath: vine.array(vine.string()).optional(), // Array of folder IDs representing the path
    })
  )

  // Helper function to initialize empty folder tree
  private initializeFolderTree(): TreeNode {
    return {
      id: 'root',
      name: 'Root',
      type: 'folder',
      children: [],
    }
  }

  // Helper function to find a node in the tree by path
  private findNodeByPath(tree: TreeNode, path: string[]): TreeNode | null {
    if (!path || path.length === 0) return tree

    let current = tree
    for (const folderId of path) {
      const child = current.children?.find((node) => node.id === folderId && node.type === 'folder')
      if (!child) return null
      current = child
    }
    return current
  }

  // Helper function to add a node to the tree
  private addNodeToTree(tree: TreeNode, node: TreeNode, path: string[]): boolean {
    const parent = this.findNodeByPath(tree, path)
    if (!parent) return false

    if (!parent.children) parent.children = []
    parent.children.push(node)
    return true
  }

  // Create a new note
  async createNote({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const payload = await request.validateUsing(NotesController.createValidator)

      // Verify that the project exists and belongs to the user
      const project = await Project.query()
        .where('id', payload.projectId)
        .where('userId', user.id)
        .whereNull('deletedAt')
        .first()

      if (!project) {
        return response.notFound({
          message: 'Project not found or you do not have access to it',
        })
      }

      // Create the note in the database
      const note = await Note.create({
        userId: user.id,
        projectId: payload.projectId,
        content: payload.content || '',
      })

      // Update the folder tree
      let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

      // Create the note node for the tree
      const noteNode: TreeNode = {
        id: randomUUID(),
        name: payload.name,
        type: 'note',
        noteId: note.id,
      }

      // Add the note to the specified path (or root if no path provided)
      const folderPath = payload.folderPath || []
      const added = this.addNodeToTree(folderTree, noteNode, folderPath)

      if (!added) {
        // If we couldn't add to the specified path, add to root
        folderTree.children = folderTree.children || []
        folderTree.children.push(noteNode)
      }

      // Update the project with the new folder tree
      await project.merge({ folderTree: folderTree as unknown as JSON }).save()

      return response.created({
        message: 'Note created successfully',
        note: {
          id: note.id,
          userId: note.userId,
          projectId: note.projectId,
          content: note.content,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
        treeNode: {
          id: noteNode.id,
          name: noteNode.name,
          type: noteNode.type,
          noteId: noteNode.noteId,
        },
        project: {
          id: project.id,
          name: project.name,
          folderTree: folderTree,
        },
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create note',
      })
    }
  }

  // Create a new folder
  async createFolder({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const payload = await request.validateUsing(NotesController.createFolderValidator)

      // Verify that the project exists and belongs to the user
      const project = await Project.query()
        .where('id', payload.projectId)
        .where('userId', user.id)
        .whereNull('deletedAt')
        .first()

      if (!project) {
        return response.notFound({
          message: 'Project not found or you do not have access to it',
        })
      }

      // Update the folder tree
      let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

      // Create the folder node for the tree
      const folderNode: TreeNode = {
        id: randomUUID(),
        name: payload.name,
        type: 'folder',
        children: [],
      }

      // Add the folder to the specified path (or root if no path provided)
      const folderPath = payload.folderPath || []
      const added = this.addNodeToTree(folderTree, folderNode, folderPath)

      if (!added) {
        // If we couldn't add to the specified path, add to root
        folderTree.children = folderTree.children || []
        folderTree.children.push(folderNode)
      }

      // Update the project with the new folder tree
      await project.merge({ folderTree: folderTree as unknown as JSON }).save()

      return response.created({
        message: 'Folder created successfully',
        folder: {
          id: folderNode.id,
          name: folderNode.name,
          type: folderNode.type,
        },
        project: {
          id: project.id,
          name: project.name,
          folderTree: folderTree,
        },
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create folder',
      })
    }
  }

  // Get project folder tree
  async getProjectTree({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const projectId = request.param('projectId')

      // Verify that the project exists and belongs to the user
      const project = await Project.query()
        .where('id', projectId)
        .where('userId', user.id)
        .whereNull('deletedAt')
        .first()

      if (!project) {
        return response.notFound({
          message: 'Project not found or you do not have access to it',
        })
      }

      const folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

      return response.ok({
        message: 'Project tree retrieved successfully',
        project: {
          id: project.id,
          name: project.name,
          folderTree: folderTree,
        },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve project tree',
      })
    }
  }

  // Get a single note by its ID
  async getNoteById({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const noteId = request.param('noteId')

      const note = await Note.query().where('id', noteId).andWhere('user_id', user.id).first()

      if (!note) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }

      return response.ok({
        message: 'Note retrieved successfully',
        note,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve note',
      })
    }
  }
}
