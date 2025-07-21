import type { HttpContext } from '@adonisjs/core/http'
import Note from '#models/note'
import Project from '#models/project'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import LibraryItem from '#models/library_item'
import StudyOptions from '#models/study_options'

interface TreeNode {
  id: string
  name: string
  type: 'folder' | 'note'
  noteId?: string // Only for note nodes
  children?: TreeNode[]
}

export default class NotesController {
  static availableStudyOptions = {
    flashcard: 'Flashcard',
    blurtItOut: 'Blurt It Out',
    multipleChoice: 'Multiple Choice',
    fillInTheBlank: 'Fill In The Blank',
    matching: 'Matching',
    shortAnswer: 'Short Answer',
    essay: 'Essay',
  }

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

  static deleteFolderValidator = vine.compile(
    vine.object({
      projectId: vine.string().trim().minLength(1),
      folderPath: vine.array(vine.string()), // Array of folder IDs representing the path to the folder
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
        name: payload.name,
        content: payload.content || '',
      })

      // Create a default study options entry for the new note
      await StudyOptions.create({
        noteId: note.id,
        flashcard: false,
        blurtItOut: false,
        multipleChoice: false,
        fillInTheBlank: false,
        matching: false,
        shortAnswer: false,
        essay: false,
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
          name: note.name,
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

      const note = await Note.query()
        .where('id', noteId)
        .andWhere('user_id', user.id)
        .preload('libraryItems')
        .first()

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

  // Get study options for a note
  async getStudyOptions({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const noteId = request.param('noteId')

      // Check if the note exists and belongs to the user
      const note = await Note.query().where('id', noteId).where('user_id', user.id).first()
      if (!note) {
        return response.notFound({ message: 'Note not found.' })
      }

      // Fetch study options
      const studyOptions = await StudyOptions.query().where('note_id', noteId).first()

      if (!studyOptions) {
        // This case should ideally not happen if options are created with each note
        return response.notFound({ message: 'Study options not found for this note.' })
      }

      return response.ok(studyOptions)
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve study options.',
        error: error.message,
      })
    }
  }

  async getAvailableStudyOptions({ response }: HttpContext) {
    return response.ok(NotesController.availableStudyOptions)
  }

  static updateStudyOptionsValidator = vine.compile(
    vine.object({
      flashcard: vine.boolean().optional(),
      blurtItOut: vine.boolean().optional(),
      multipleChoice: vine.boolean().optional(),
      fillInTheBlank: vine.boolean().optional(),
      matching: vine.boolean().optional(),
      shortAnswer: vine.boolean().optional(),
      essay: vine.boolean().optional(),
    })
  )

  // Update study options for a note
  async updateStudyOptions({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const noteId = request.param('noteId')
      const payload = await request.validateUsing(NotesController.updateStudyOptionsValidator)

      // Check if the note exists and belongs to the user
      const note = await Note.query().where('id', noteId).where('user_id', user.id).first()
      if (!note) {
        return response.notFound({ message: 'Note not found.' })
      }

      const studyOptions = await StudyOptions.query().where('note_id', noteId).firstOrFail()
      studyOptions.merge(payload)
      await studyOptions.save()

      return response.ok(studyOptions)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      return response.internalServerError({
        message: 'Failed to update study options.',
        error: error.message,
      })
    }
  }

  // Update note validator
  static updateValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1).maxLength(255).optional(),
      content: vine.string().trim().optional(),
    })
  )

  // Helper function to update note name in folder tree
  private updateNoteInTree(tree: TreeNode, noteId: string, newName: string): boolean {
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

  // Update a note by its ID
  async updateNote({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const noteId = request.param('noteId')
      const payload = await request.validateUsing(NotesController.updateValidator)

      const note = await Note.query().where('id', noteId).andWhere('user_id', user.id).first()

      if (!note) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }

      // Update the note
      await note.merge(payload).save()

      // If the name changed, update the folder tree as well
      if (payload.name && note.projectId) {
        const project = await Project.query()
          .where('id', note.projectId)
          .where('userId', user.id)
          .whereNull('deletedAt')
          .first()

        if (project) {
          let folderTree =
            (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

          // Update the note name in the folder tree
          this.updateNoteInTree(folderTree, noteId, payload.name)

          // Save the updated folder tree
          await project.merge({ folderTree: folderTree as unknown as JSON }).save()
        }
      }

      return response.ok({
        message: 'Note updated successfully',
        note,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to update note',
      })
    }
  }

  // Helper function to remove note from folder tree
  private removeNoteFromTree(tree: TreeNode, noteId: string): boolean {
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

  // Helper function to remove a node (folder or note) from the tree by ID
  private removeNodeById(tree: TreeNode, nodeId: string): boolean {
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

  // Delete a note by its ID
  async deleteNote({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const noteId = request.param('noteId')

      const note = await Note.query().where('id', noteId).andWhere('user_id', user.id).first()

      if (!note) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }

      // Get the project to update folder tree
      const project = await Project.query()
        .where('id', note.projectId!)
        .where('userId', user.id)
        .whereNull('deletedAt')
        .first()

      if (project) {
        let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

        // Remove the note from the folder tree
        this.removeNoteFromTree(folderTree, noteId)

        // Update the project with the new folder tree
        await project.merge({ folderTree: folderTree as unknown as JSON }).save()
      }

      // Delete the note from database
      await note.delete()

      return response.ok({
        message: 'Note deleted successfully',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to delete note',
      })
    }
  }

  async deleteFolder({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const { projectId, folderId } = request.params()

      const project = await Project.query()
        .where('id', projectId)
        .where('user_id', user.id)
        .firstOrFail()

      let folderTree = (project.folderTree as unknown as TreeNode) || this.initializeFolderTree()

      const removed = this.removeNodeById(folderTree, folderId)

      if (!removed) {
        return response.notFound({ message: 'Folder not found in the project tree.' })
      }

      await project.merge({ folderTree: folderTree as unknown as JSON }).save()

      return response.ok({ message: 'Folder deleted successfully.' })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      return response.internalServerError({ message: 'Failed to delete folder.' })
    }
  }

  async addLibraryItemToNote({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const { noteId, libraryItemId } = request.params()

    const note = await Note.query().where('id', noteId).where('user_id', user.id).firstOrFail()
    const libraryItem = await LibraryItem.findOrFail(libraryItemId)

    // Ensure the library item belongs to the same project
    if (note.projectId !== libraryItem.projectId) {
      return response.badRequest({
        message: 'Note and Library Item do not belong to the same project.',
      })
    }

    await libraryItem.merge({ noteId: note.id }).save()

    return response.ok({ message: 'Library item added to note successfully.' })
  }

  async removeLibraryItemFromNote({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const { noteId, libraryItemId } = request.params()

    const note = await Note.query().where('id', noteId).where('user_id', user.id).firstOrFail()
    const libraryItem = await LibraryItem.findOrFail(libraryItemId)

    // Ensure the library item is actually associated with the note
    if (libraryItem.noteId !== note.id) {
      return response.badRequest({ message: 'Library item is not associated with this note.' })
    }

    await libraryItem.merge({ noteId: null }).save()
    return response.ok({ message: 'Library item removed from note successfully.' })
  }
}
