# Services Documentation

This directory contains the business logic layer for the Noted API. Services handle complex operations, data transformations, and orchestration between models and external systems.

## Table of Contents

1. [Authorization Service](#authorization-service)
2. [AI Service](#ai-service)
3. [Flashcard Service](#flashcard-service)
4. [Multiple Choice Service](#multiple-choice-service)
5. [Free Response Service](#free-response-service)
6. [Project Service](#project-service)
7. [Note Service](#note-service)
8. [Library Service](#library-service)
9. [Native Vector Service](#native-vector-service)
10. [Native Pinecone Service](#native-pinecone-service)
11. [Intelligent QA Service](#intelligent-qa-service)
12. [Intent Classification Service](#intent-classification-service)
13. [Native QA Service](#native-qa-service)
14. [Hybrid QA Service](#hybrid-qa-service)
15. [External Knowledge Service](#external-knowledge-service)
16. [Todo Service](#todo-service)
17. [JWKS Service](#jwks-service)

---

## Authorization Service

**Purpose:** Centralized authorization checks for all resource access in the application.

### Functions

#### `canAccessProject(userId: string, projectId: string): Promise<boolean>`
Checks if a user has access to a specific project.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project to check
- **Returns:** Boolean indicating access permission
- **Usage:** Used before read operations to verify access

#### `getProjectForUser(userId: string, projectId: string): Promise<Project>`
Retrieves a project if the user has access, throws error otherwise.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project to retrieve
- **Returns:** Project model instance
- **Throws:** Error if project not found or access denied
- **Usage:** Primary method for secured project retrieval

#### `canAccessNote(userId: string, noteId: string): Promise<boolean>`
Checks if a user has access to a specific note.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note to check
- **Returns:** Boolean indicating access permission

#### `getNoteForUser(userId: string, noteId: string): Promise<Note>`
Retrieves a note if the user has access, throws error otherwise.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note to retrieve
- **Returns:** Note model instance
- **Throws:** Error if note not found or access denied

#### `canAccessFlashcard(userId: string, flashcardId: string): Promise<boolean>`
Checks if a user has access to a specific flashcard.
- **Parameters:**
  - `userId`: The user's ID
  - `flashcardId`: The flashcard to check
- **Returns:** Boolean indicating access permission

#### `getFlashcardForUser(userId: string, flashcardId: string): Promise<Flashcard>`
Retrieves a flashcard if the user has access.
- **Parameters:**
  - `userId`: The user's ID
  - `flashcardId`: The flashcard to retrieve
- **Returns:** Flashcard model instance
- **Throws:** Error if flashcard not found or access denied

#### `canAccessLibraryItem(userId: string, libraryItemId: string): Promise<boolean>`
Checks if a user has access to a library item. Access is granted if:
- The item is global, OR
- The item belongs to a project the user owns
- **Parameters:**
  - `userId`: The user's ID
  - `libraryItemId`: The library item to check
- **Returns:** Boolean indicating access permission

#### `getLibraryItemForUser(userId: string, libraryItemId: string): Promise<LibraryItem>`
Retrieves a library item if the user has access.
- **Parameters:**
  - `userId`: The user's ID
  - `libraryItemId`: The library item to retrieve
- **Returns:** LibraryItem model instance with preloaded project
- **Throws:** Error if library item not found or access denied

#### `canAccessMultipleChoiceSet(userId: string, setId: string): Promise<boolean>`
Checks if a user has access to a multiple choice set.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The set to check
- **Returns:** Boolean indicating access permission

#### `getMultipleChoiceSetForUser(userId: string, setId: string): Promise<MultipleChoiceSet>`
Retrieves a multiple choice set if the user has access.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The set to retrieve
- **Returns:** MultipleChoiceSet model instance
- **Throws:** Error if set not found or access denied

#### `getUserProjectIds(userId: string): Promise<string[]>`
Gets all project IDs belonging to a user.
- **Parameters:**
  - `userId`: The user's ID
- **Returns:** Array of project IDs (excluding soft-deleted projects)
- **Usage:** Used for bulk filtering and authorization checks

#### `validateNoteLibraryItemRelation(noteId: string, libraryItemId: string): Promise<boolean>`
Validates that a note and library item belong to the same project.
- **Parameters:**
  - `noteId`: The note ID
  - `libraryItemId`: The library item ID
- **Returns:** Boolean indicating if they share the same project
- **Usage:** Used when attaching library items to notes

---

## AI Service

**Purpose:** Orchestrates AI-powered study material generation (flashcards, multiple choice, free response).

### Functions

#### `generateFlashcardSet(data: FlashcardGenerationData): Promise<GenerationResult>`
Generates a complete flashcard set from notes and library items using AI.
- **Parameters:**
  - `data.flashcardSetId`: The flashcard set ID to populate
  - `data.userId`: The user generating the flashcards
  - `data.projectId`: The project context
  - `data.selectedNoteIds`: Array of note IDs to use as source material
  - `data.selectedLibraryItemIds`: Array of library item IDs to use as source material
- **Returns:** Success/failure status with flashcard count
- **Process:**
  1. Fetches content from selected notes
  2. Extracts text from library item PDFs
  3. Combines content sources
  4. Generates flashcards using AI (GPT-4o)
  5. Saves flashcards to database with set association
- **AI Model:** Uses default model (gpt-4o) with flashcard generation prompt
- **Token Limit:** Truncates content to token limit before sending to AI

#### `generateMultipleChoiceSet(data: MultipleChoiceGenerationData): Promise<GenerationResult>`
Generates a multiple choice question set from notes and library items using AI.
- **Parameters:**
  - `data.multipleChoiceSetId`: The set ID to populate
  - `data.userId`: The user generating the questions
  - `data.projectId`: The project context
  - `data.selectedNoteIds`: Array of note IDs to use as source material
  - `data.selectedLibraryItemIds`: Array of library item IDs to use as source material
- **Returns:** Success/failure status with question count
- **Process:**
  1. Fetches content from selected notes
  2. Extracts text from library item PDFs
  3. Combines content sources
  4. Generates questions using AI (GPT-4o)
  5. Saves questions to database with set association
- **AI Model:** Uses default model (gpt-4o) with multiple choice prompt

#### `generateFreeResponseSet(data: FreeResponseGenerationData): Promise<GenerationResult>`
Generates free response questions with rubrics from notes and library items using AI.
- **Parameters:**
  - `data.freeResponseSetId`: The set ID to populate
  - `data.userId`: The user generating the questions
  - `data.projectId`: The project context
  - `data.selectedNoteIds`: Array of note IDs to use as source material
  - `data.selectedLibraryItemIds`: Array of library item IDs to use as source material
- **Returns:** Success/failure status with question count
- **Process:**
  1. Fetches content from selected notes
  2. Extracts text from library item PDFs
  3. Combines content sources
  4. Generates questions with rubrics using AI (GPT-4o)
  5. Saves questions to database with JSON rubric data
- **AI Model:** Uses default model (gpt-4o) with free response prompt

### Private Helper Functions

#### `fetchNoteData(noteId: string, userId: string): Promise<Note | null>`
Fetches note content with authorization check.

#### `fetchLibraryItems(libraryItemIds: string[], projectId: string): Promise<LibraryItem[]>`
Fetches library items for a project, including global items.

#### `extractContentFromFiles(libraryItems: LibraryItem[]): Promise<string>`
Downloads and extracts text from PDF library items using S3 and pdf.js.

#### `generateFlashcardsWithAI(contentSources: string[], noteName: string): Promise<Array<{term: string, definition: string}>>`
Sends combined content to OpenAI and parses flashcard JSON response.

#### `generateMultipleChoiceWithAI(contentSources: string[], setName: string): Promise<Array<{question: string, answer: string}>>`
Sends combined content to OpenAI and parses multiple choice JSON response.

#### `generateFreeResponseWithAI(contentSources: string[], setName: string): Promise<Array<{question: string, answer: string, rubric: Array}>>`
Sends combined content to OpenAI and parses free response JSON with rubrics.

#### `saveFlashcardSetToDatabase(flashcards: Array, flashcardSetId: string, userId: string, projectId: string): Promise<boolean>`
Batch inserts flashcards into database within a transaction.

#### `saveMultipleChoiceSetToDatabase(questions: Array, multipleChoiceSetId: string): Promise<boolean>`
Batch inserts multiple choice questions into database within a transaction.

#### `saveFreeResponseSetToDatabase(questions: Array, freeResponseSetId: string): Promise<boolean>`
Batch inserts free response questions with JSON rubrics into database within a transaction.

---

## Flashcard Service

**Purpose:** Manages flashcard sets and their associated flashcards.

### Functions

#### `getProjectFlashcardSets(userId: string, projectId: string): Promise<FlashcardSet[]>`
Retrieves all flashcard sets for a project with preloaded relationships.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Array of flashcard sets with notes, library items, and flashcards preloaded
- **Ordering:** By creation date (newest first)
- **Authorization:** Verifies project access before retrieval

#### `getFlashcardSet(userId: string, setId: string): Promise<FlashcardSet>`
Retrieves a specific flashcard set with all relationships.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The flashcard set ID
- **Returns:** FlashcardSet with preloaded notes, library items, and flashcards
- **Throws:** Error if set not found or access denied

#### `updateFlashcardSet(userId: string, setId: string, payload: {name: string}): Promise<FlashcardSet>`
Updates a flashcard set's name.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The flashcard set ID
  - `payload.name`: New name for the set
- **Returns:** Updated flashcard set
- **Authorization:** Verifies ownership before update

#### `deleteFlashcardSet(userId: string, setId: string): Promise<void>`
Deletes a flashcard set and all associated flashcards.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The flashcard set ID
- **Database:** CASCADE delete removes all associated flashcards
- **Authorization:** Verifies ownership before deletion

#### `markFlashcardsAsNeedingUpdate(userId: string, noteId: string): Promise<void>`
Marks all flashcards associated with a note as needing update.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
- **Usage:** Called when note content changes to indicate flashcards may be stale
- **Database:** Updates `needs_update` flag for all related flashcards

---

## Multiple Choice Service

**Purpose:** Manages multiple choice question sets and their questions.

### Functions

#### `getProjectMultipleChoiceSets(userId: string, projectId: string): Promise<MultipleChoiceSet[]>`
Retrieves all multiple choice sets for a project with preloaded relationships.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Array of sets with notes, library items, and questions preloaded
- **Ordering:** By creation date (newest first)
- **Authorization:** Verifies project access before retrieval

#### `getMultipleChoiceSet(userId: string, setId: string): Promise<MultipleChoiceSet>`
Retrieves a specific multiple choice set with all relationships.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The set ID
- **Returns:** MultipleChoiceSet with preloaded notes, library items, and questions
- **Throws:** Error if set not found or access denied

#### `updateMultipleChoiceSet(userId: string, setId: string, payload: {name: string}): Promise<MultipleChoiceSet>`
Updates a multiple choice set's name.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The set ID
  - `payload.name`: New name for the set
- **Returns:** Updated multiple choice set
- **Authorization:** Verifies ownership before update

#### `deleteMultipleChoiceSet(userId: string, setId: string): Promise<void>`
Deletes a multiple choice set and all associated questions.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The set ID
- **Process:**
  1. Deletes all questions in the set
  2. Deletes the set itself
- **Authorization:** Verifies ownership before deletion

---

## Free Response Service

**Purpose:** Manages free response question sets and AI-powered evaluation.

### Functions

#### `getProjectFreeResponseSets(userId: string, projectId: string): Promise<FreeResponseSet[]>`
Retrieves all free response sets for a project with preloaded relationships.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Array of sets with notes, library items, and questions preloaded
- **Ordering:** By creation date (newest first)
- **Authorization:** Verifies project access before retrieval

#### `getFreeResponseSet(userId: string, setId: string): Promise<FreeResponseSet>`
Retrieves a specific free response set with all relationships.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The set ID
- **Returns:** FreeResponseSet with preloaded notes, library items, and questions
- **Throws:** Error if set not found or access denied

#### `updateFreeResponseSet(userId: string, setId: string, payload: {name: string}): Promise<FreeResponseSet>`
Updates a free response set's name.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The set ID
  - `payload.name`: New name for the set
- **Returns:** Updated free response set

#### `deleteFreeResponseSet(userId: string, setId: string): Promise<void>`
Deletes a free response set and all associated questions and evaluations.
- **Parameters:**
  - `userId`: The user's ID
  - `setId`: The set ID
- **Process:**
  1. Deletes all evaluations for questions in the set
  2. Deletes all questions in the set
  3. Deletes the set itself
- **Cascade:** Manually handles cascade deletion for complex relationships

#### `evaluateUserResponse(userId: string, freeResponseId: string, userAnswer: string): Promise<FreeResponseEvaluation>`
Evaluates a user's answer to a free response question using AI and rubric.
- **Parameters:**
  - `userId`: The user's ID
  - `freeResponseId`: The question ID
  - `userAnswer`: The user's submitted answer
- **Returns:** FreeResponseEvaluation with score, feedback, and rubric scores
- **AI Model:** Uses GPT-4o for evaluation
- **Process:**
  1. Retrieves question with rubric
  2. Sends to AI with evaluation prompt
  3. Parses AI evaluation (percentage, feedback, strengths, improvements)
  4. Stores evaluation in database
- **Fallback:** If AI fails, uses keyword matching algorithm

#### `getEvaluationHistory(userId: string, freeResponseId: string): Promise<FreeResponseEvaluation[]>`
Retrieves all evaluations for a specific question by a user.
- **Parameters:**
  - `userId`: The user's ID
  - `freeResponseId`: The question ID
- **Returns:** Array of evaluations ordered by creation date (newest first)
- **Usage:** Shows user's attempt history and improvement over time

### Private Helper Functions

#### `createAIEvaluation(freeResponseId, userId, userAnswer, question, expectedAnswer, rubric): Promise<FreeResponseEvaluation>`
Uses AI to evaluate answer against rubric with detailed feedback.

#### `createFallbackEvaluation(freeResponseId, userId, userAnswer, expectedAnswer): Promise<FreeResponseEvaluation>`
Basic keyword matching evaluation when AI is unavailable.

---

## Project Service

**Purpose:** Manages projects and their hierarchical folder/note tree structure.

### Functions

#### `createProject(data: CreateProjectData): Promise<Project>`
Creates a new project with initialized folder tree.
- **Parameters:**
  - `data.name`: Project name
  - `data.description`: Optional project description
  - `data.color`: Optional color for UI
  - `data.userId`: Owner user ID
- **Returns:** Created project with empty folder tree
- **Tree:** Initializes with root folder node

#### `getUserProjects(userId: string): Promise<Project[]>`
Retrieves all projects for a user.
- **Parameters:**
  - `userId`: The user's ID
- **Returns:** Array of projects ordered by creation date (newest first)
- **Filtering:** Excludes soft-deleted projects

#### `getProjectById(userId: string, projectId: string): Promise<Project>`
Retrieves a project by ID with authorization.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Project instance
- **Authorization:** Verifies ownership and non-deleted status

#### `getProjectNotes(userId: string, projectId: string): Promise<Note[]>`
Retrieves all notes for a project.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Array of notes ordered by creation date (newest first)
- **Filtering:** Excludes system notes (e.g., `__LIBRARY_ITEMS_SYSTEM__`)

#### `getProjectNotesSummary(userId: string, projectId: string): Promise<Array<{id, name, createdAt}>>`
Retrieves lightweight note summaries (no content).
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Array of note summaries with only id, name, createdAt
- **Performance:** Much faster than full note retrieval

#### `getProjectWithRelations(userId: string, projectId: string): Promise<Project>`
Retrieves a project with preloaded library items.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Project with library items preloaded

#### `getProjectTree(userId: string, projectId: string): Promise<ProjectWithTree>`
Retrieves the project's folder/note tree structure.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Project metadata with full folderTree JSON structure
- **Tree Structure:** Hierarchical nodes with folders and notes

#### `addFolderToTree(userId, projectId, folderName, folderPath): Promise<{project, folderNode}>`
Adds a new folder to the project tree at the specified path.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `folderName`: Name for the new folder
  - `folderPath`: Array of folder IDs representing the path (empty for root)
- **Returns:** Updated project and the created folder node
- **UUID:** Generates random UUID for folder ID

#### `addNoteToTree(userId, projectId, noteId, noteName, folderPath): Promise<{project, noteNode}>`
Adds a note to the project tree at the specified path.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `noteId`: The note's database ID
  - `noteName`: Display name for the note
  - `folderPath`: Array of folder IDs representing the path
- **Returns:** Updated project and the created note node
- **Tree Node:** Creates tree node with reference to actual note

#### `removeFolderFromTree(userId, projectId, folderId): Promise<Project>`
Removes a folder and all its contents from the tree.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `folderId`: The folder node ID to remove
- **Cascade:** Removes all child folders and notes
- **Note:** Does not delete actual notes from database, only removes from tree

#### `updateNoteNameInTree(userId, projectId, noteId, newName): Promise<Project>`
Updates a note's display name in the tree.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `noteId`: The note's database ID
  - `newName`: New display name
- **Returns:** Updated project

#### `removeNoteFromProjectTree(userId, projectId, noteId): Promise<Project>`
Removes a note from the tree.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `noteId`: The note's database ID
- **Note:** Does not delete the actual note from database

#### `getProjectToolsData(userId, projectId): Promise<ToolsData>`
Gets optimized data for project tools page with counts and recent items.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Object with:
  - `counts`: Note, library item, flashcard set, multiple choice set counts
  - `recentNotes`: 20 most recent notes (id, name, hasContent)
  - `recentLibraryItems`: 20 most recent library items (id, name, type, size)
- **Performance:** Uses count queries instead of loading full data

#### `updateProject(userId, projectId, data): Promise<Project>`
Updates project metadata.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `data`: Object with name, description, and/or color
- **Returns:** Updated project

#### `deleteProject(userId, projectId): Promise<void>`
Soft-deletes a project and cascade deletes all associated data.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Transaction:** Uses database transaction for atomicity
- **Cascade Deletion:**
  1. Vector chunks (notes and library items)
  2. Pivot table entries (starred items, set associations)
  3. Free response evaluations and questions
  4. Multiple choice questions
  5. Flashcards and flashcard sets
  6. Study options
  7. Library items (project-specific only)
  8. Notes
  9. Todos
  10. Project (soft delete with deleted_at timestamp)

#### `moveNode(userId, projectId, nodeId, newParentId, newIndex): Promise<Project>`
Moves a node (folder or note) to a new location in the tree.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `nodeId`: The node to move
  - `newParentId`: The target parent folder ID
  - `newIndex`: Position in new parent's children array
- **Validation:** Prevents moving folder into itself or its descendants
- **Reordering:** Updates order property for affected nodes

#### `reorderNodes(userId, projectId, parentId, childIds): Promise<Project>`
Reorders children within a parent node.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `parentId`: The parent folder ID
  - `childIds`: Array of child IDs in desired order
- **Validation:** Ensures all IDs exist and belong to parent

### Tree Manipulation Functions

#### `initializeFolderTree(): TreeNode`
Creates an empty folder tree with root node.

#### `findNodeByPath(tree: TreeNode, path: string[]): TreeNode | null`
Finds a node in the tree by following a path of folder IDs.

#### `addNodeToTree(tree, node, path): boolean`
Adds a node at the specified path in the tree.

#### `removeNodeById(tree, nodeId): boolean`
Removes a node by ID from the tree (recursively searches).

#### `removeNoteFromTree(tree, noteId): boolean`
Removes a note by noteId from the tree.

#### `updateNoteInTree(tree, noteId, newName): boolean`
Updates a note's name in the tree.

#### `findNodeById(tree, nodeId, parent): {node, parent} | null`
Finds a node and its parent by ID.

#### `isDescendant(tree, ancestorId, descendantId): boolean`
Checks if a node is a descendant of another node.

#### `moveNodeInTree(tree, nodeId, newParentId, newIndex): boolean`
Moves a node to a new parent at a specific position.

#### `reorderChildrenInTree(tree, parentId, childIds): boolean`
Reorders children within a parent based on ID array.

---

## Note Service

**Purpose:** Manages notes, study options, folder creation, and library item attachments.

### Functions

#### `getOrCreateLibrarySystemNote(projectId: string, userId: string): Promise<Note>`
Gets or creates a system note for library items in a project.
- **Parameters:**
  - `projectId`: The project ID
  - `userId`: The user's ID
- **Returns:** System note (creates if doesn't exist)
- **Purpose:** Ensures library items have a valid note_id for foreign key constraints
- **Name:** `__LIBRARY_ITEMS_SYSTEM__`
- **Hidden:** Excluded from normal note listings

#### `createNote(data: CreateNoteData): Promise<{note, treeNode, project}>`
Creates a new note with default study options and adds to project tree.
- **Parameters:**
  - `data.userId`: The user's ID
  - `data.projectId`: The project ID
  - `data.name`: Note name
  - `data.content`: Optional initial content
  - `data.folderPath`: Optional folder path array
- **Returns:** Created note, tree node, and project data
- **Process:**
  1. Creates note in database
  2. Creates default study options (all null)
  3. Adds note to project tree at specified path

#### `getNoteById(userId: string, noteId: string): Promise<Note>`
Retrieves a note by ID with library items preloaded.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
- **Returns:** Note with preloaded library items
- **Authorization:** Verifies ownership

#### `updateNote(userId, noteId, data: UpdateNoteData): Promise<Note>`
Updates note content and/or name.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
  - `data`: Object with name and/or content
- **Returns:** Updated note
- **Side Effect:** Updates note name in project tree if name changed

#### `deleteNote(userId, noteId): Promise<void>`
Deletes a note and removes it from the project tree.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
- **Process:**
  1. Removes note from project tree
  2. Deletes note from database
- **Cascade:** Database handles deletion of associated study options

#### `getStudyOptions(userId, noteId): Promise<StudyOptions>`
Retrieves study options for a note.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
- **Returns:** StudyOptions model with all option fields

#### `updateStudyOptions(userId, noteId, data: StudyOptionsData): Promise<StudyOptions>`
Updates study options for a note.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
  - `data`: Study options to update (flashcard, blurtItOut, multipleChoice, etc.)
- **Returns:** Updated study options

#### `getAvailableStudyOptions(): Record<string, string>`
Returns static map of available study option types.
- **Returns:** Object mapping option keys to display names
- **Static Data:**
  - flashcard: "Flashcard"
  - blurtItOut: "Blurt It Out"
  - multipleChoice: "Multiple Choice"
  - fillInTheBlank: "Fill In The Blank"
  - matching: "Matching"
  - shortAnswer: "Short Answer"
  - essay: "Essay"

#### `addLibraryItemToNote(userId, noteId, libraryItemId): Promise<void>`
Attaches a library item to a note.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
  - `libraryItemId`: The library item ID
- **Validation:** Ensures note and library item are in same project
- **Database:** Updates library item's noteId field

#### `removeLibraryItemFromNote(userId, noteId, libraryItemId): Promise<void>`
Detaches a library item from a note.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
  - `libraryItemId`: The library item ID
- **Validation:** Ensures library item is actually attached to note
- **Database:** Sets library item's noteId to null
- **Side Effect:** Triggers vector metadata update (moves vectors to system note)

#### `createFolder(userId, projectId, folderName, folderPath): Promise<{folder, project}>`
Creates a folder in the project tree.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `folderName`: Folder name
  - `folderPath`: Parent folder path (empty for root)
- **Returns:** Folder node and updated project
- **Delegates:** Calls ProjectService.addFolderToTree

#### `deleteFolder(userId, projectId, folderId): Promise<void>`
Deletes a folder from the project tree.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
  - `folderId`: The folder ID
- **Delegates:** Calls ProjectService.removeFolderFromTree

#### `getProjectTree(userId, projectId): Promise<ProjectWithTree>`
Retrieves the project tree structure.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Project with folder tree
- **Delegates:** Calls ProjectService.getProjectTree

---

## Library Service

**Purpose:** Manages file uploads, library items, and S3 presigned URLs.

### Functions

#### `getPresignedUrl(data: PresignedUrlData): Promise<PresignedUrlResponse>`
Generates presigned URL for file upload to S3.
- **Parameters:**
  - `data.fileName`: Name of file to upload
  - `data.fileType`: MIME type of file
- **Returns:** Object with presignedUrl, key, and expiresIn
- **Usage:** Client uploads directly to S3 using this URL

#### `createLibraryItem(data: CreateLibraryItemData): Promise<LibraryItem>`
Creates library item record after successful S3 upload.
- **Parameters:**
  - `data.userId`: The user's ID
  - `data.projectId`: The project ID
  - `data.fileName`: Name of uploaded file
  - `data.fileType`: MIME type
  - `data.key`: S3 storage key
  - `data.size`: File size in bytes
  - `data.isGlobal`: Optional global flag
- **Returns:** Created library item
- **Authorization:** Verifies project access

#### `getAllLibraryItems(userId: string): Promise<LibraryItem[]>`
Retrieves all library items across all user's projects.
- **Parameters:**
  - `userId`: The user's ID
- **Returns:** Array of library items (user's + global items)
- **Ordering:** By creation date (newest first)

#### `getProjectLibraryItems(userId, projectId): Promise<LibraryItem[]>`
Retrieves library items for a specific project.
- **Parameters:**
  - `userId`: The user's ID
  - `projectId`: The project ID
- **Returns:** Array of library items (project-specific + global items)
- **Authorization:** Verifies project access

#### `getLibraryItemById(userId, libraryItemId): Promise<LibraryItem>`
Retrieves a library item by ID.
- **Parameters:**
  - `userId`: The user's ID
  - `libraryItemId`: The library item ID
- **Returns:** Library item
- **Authorization:** Checks access (owner or global item)

#### `getLibraryItemViewUrl(userId, libraryItemId): Promise<{presignedUrl, expiresIn}>`
Generates presigned URL for viewing/downloading a file.
- **Parameters:**
  - `userId`: The user's ID
  - `libraryItemId`: The library item ID
- **Returns:** Presigned URL for GET request to S3
- **Authorization:** Verifies access before generating URL

#### `toggleGlobalStatus(userId, libraryItemId): Promise<LibraryItem>`
Toggles the global flag on a library item.
- **Parameters:**
  - `userId`: The user's ID
  - `libraryItemId`: The library item ID
- **Returns:** Updated library item
- **Authorization:** Only project owner can toggle

#### `deleteLibraryItem(userId, libraryItemId): Promise<void>`
Deletes a library item.
- **Parameters:**
  - `userId`: The user's ID
  - `libraryItemId`: The library item ID
- **Authorization:** Only project owner can delete
- **TODO:** Consider implementing S3 file deletion

#### `updateLibraryItem(userId, libraryItemId, data): Promise<LibraryItem>`
Updates library item metadata (name or global status).
- **Parameters:**
  - `userId`: The user's ID
  - `libraryItemId`: The library item ID
  - `data`: Object with name and/or isGlobal
- **Returns:** Updated library item
- **Authorization:** Only project owner can update

#### `getLibraryItemsByNote(userId, noteId): Promise<LibraryItem[]>`
Retrieves all library items attached to a note.
- **Parameters:**
  - `userId`: The user's ID
  - `noteId`: The note ID
- **Returns:** Array of library items ordered by creation date
- **Authorization:** Verifies note access

#### `searchLibraryItems(userId, query, projectId?, mimeType?): Promise<LibraryItem[]>`
Searches library items by name and optional filters.
- **Parameters:**
  - `userId`: The user's ID
  - `query`: Search string (case-insensitive)
  - `projectId`: Optional project filter
  - `mimeType`: Optional MIME type filter
- **Returns:** Up to 50 matching library items
- **Search:** ILIKE pattern matching on name
- **Filtering:** By project access and MIME type

#### `getLibraryStatistics(userId): Promise<LibraryStats>`
Gets statistics about user's library items.
- **Parameters:**
  - `userId`: The user's ID
- **Returns:** Object with:
  - `totalItems`: Total count
  - `totalSize`: Total bytes
  - `globalItems`: Count of global items
  - `projectItems`: Count of project-specific items
  - `byMimeType`: Object mapping MIME types to counts

---

## Native Vector Service

**Purpose:** Handles document vectorization, chunking, and semantic search using Pinecone.

### Functions

#### `vectorizeNote(noteId: string): Promise<void>`
Vectorizes note content and stores in Pinecone.
- **Parameters:**
  - `noteId`: The note to vectorize
- **Process:**
  1. Updates vector status to "processing"
  2. Deletes existing note vectors
  3. Splits content into 1000-character chunks with 200-char overlap
  4. Generates embeddings using OpenAI (text-embedding-3-small)
  5. Upserts vectors to Pinecone with metadata
  6. Stores chunk metadata in database
  7. Updates vector status to "completed"
- **Metadata:** Includes noteId, projectId, userId, contentType, chunkIndex
- **Error Handling:** Sets status to "failed" on error

#### `vectorizeLibraryItem(libraryItemId: string): Promise<void>`
Vectorizes PDF library item content and stores in Pinecone.
- **Parameters:**
  - `libraryItemId`: The library item to vectorize
- **Process:**
  1. Updates vector status to "processing"
  2. Downloads PDF from S3 and extracts text
  3. Determines note association (uses system note if unattached)
  4. Splits content into chunks
  5. Generates embeddings
  6. Extracts author and title metadata
  7. Upserts vectors to Pinecone
  8. Stores chunk metadata in database
  9. Updates vector status to "completed"
- **Metadata:** Includes noteId, projectId, libraryItemId, userId, sourceFile, author, title

#### `searchForQA(noteId, question, topK = 5): Promise<SearchResult[]>`
Searches for relevant chunks to answer a question with multi-layer security.
- **Parameters:**
  - `noteId`: The note context
  - `question`: The search query
  - `topK`: Number of results to return (default: 5)
- **Returns:** Array of search results with content, score, and metadata
- **Security Filters:**
  1. Note-level isolation (noteId)
  2. User-level isolation (userId)
  3. Project-level isolation (projectId)
  4. Active attachment filter (only currently attached library items)
- **Process:**
  1. Validates note exists and has project
  2. Gets currently attached library items
  3. Queries Pinecone with security filters
  4. Filters results to only include active attachments
  5. Enhances results with citation info

#### `updateLibraryItemNoteAssociation(libraryItemId, oldNoteId, newNoteId): Promise<void>`
Updates vector metadata when library item is attached/detached from note.
- **Parameters:**
  - `libraryItemId`: The library item ID
  - `oldNoteId`: Previous note ID (or null)
  - `newNoteId`: New note ID (or null)
- **Process:**
  1. If newNoteId is null, gets system note
  2. Fetches vector IDs from database
  3. Updates Pinecone metadata with new noteId
  4. Updates database records
- **Usage:** Called when library item is moved between notes
- **Critical:** Ensures vectors maintain correct note association for security

### Private Helper Functions

#### `splitText(text, chunkSize = 1000, overlap = 200): TextChunk[]`
Splits text into overlapping chunks.
- **Character-Based:** Not token-based
- **Overlap:** Maintains context between chunks

#### `deleteNoteVectors(noteId): Promise<void>`
Deletes all vectors associated with a note from Pinecone and database.

#### `deleteLibraryItemVectors(libraryItemId): Promise<void>`
Deletes all vectors associated with a library item from Pinecone and database.

#### `extractAuthor(filename, content): string | undefined`
Attempts to extract author from filename or content using regex patterns.

#### `extractTitle(filename, content): string | undefined`
Attempts to extract title from filename or content using regex patterns.

---

## Native Pinecone Service

**Purpose:** Low-level Pinecone SDK wrapper for vector database operations.

### Functions

#### `upsert(vectors: VectorRecord[]): Promise<void>`
Inserts or updates vectors in Pinecone.
- **Parameters:**
  - `vectors`: Array of vector records with id, values, and metadata
- **Batching:** Processes in batches of 100 for performance
- **Process:**
  1. Splits vectors into batches
  2. Upserts each batch
  3. Logs progress
- **Usage:** Called by vector service after generating embeddings

#### `query(queryText, topK = 5, filter?): Promise<NativeSearchResult[]>`
Searches for similar vectors using text query.
- **Parameters:**
  - `queryText`: Text to search for
  - `topK`: Number of results (default: 5)
  - `filter`: Optional metadata filter
- **Process:**
  1. Generates embedding for query text
  2. Queries Pinecone with vector
  3. Returns matches with scores and metadata
- **Returns:** Array of results with id, score, metadata, content

#### `queryByVector(vector, topK = 5, filter?): Promise<NativeSearchResult[]>`
Searches using pre-computed embedding vector.
- **Parameters:**
  - `vector`: Embedding vector (number array)
  - `topK`: Number of results
  - `filter`: Optional metadata filter
- **Returns:** Array of search results
- **Usage:** When embedding is already computed

#### `deleteByIds(ids: string[]): Promise<void>`
Deletes vectors by their IDs.
- **Parameters:**
  - `ids`: Array of vector IDs to delete
- **Usage:** Called when notes or library items are deleted/re-vectorized

#### `deleteByFilter(filter: Record<string, any>): Promise<void>`
Deletes vectors matching metadata filter.
- **Parameters:**
  - `filter`: Metadata filter object
- **Process:**
  1. Queries to get matching IDs
  2. Deletes by IDs
- **Non-Critical:** Doesn't throw errors, logs warnings instead

#### `fetch(ids: string[]): Promise<Record<string, any>>`
Fetches vector records by IDs.
- **Parameters:**
  - `ids`: Array of vector IDs
- **Returns:** Object mapping IDs to vector records
- **Usage:** Used for metadata updates

#### `updateMetadataByIds(vectorIds, metadataUpdates): Promise<void>`
Updates metadata for specific vectors.
- **Parameters:**
  - `vectorIds`: Array of vector IDs to update
  - `metadataUpdates`: Metadata fields to update/merge
- **Process:**
  1. Fetches existing vectors in batches
  2. Preserves existing values
  3. Merges updated metadata
  4. Upserts updated records
- **Batching:** Processes 100 vectors at a time
- **Error Handling:** Continues with remaining batches if one fails

#### `debugVectorIds(prefix?, limit = 10): Promise<string[]>`
Lists vector IDs in Pinecone for debugging.
- **Parameters:**
  - `prefix`: Optional prefix filter
  - `limit`: Max results (default: 10)
- **Returns:** Array of vector IDs
- **Usage:** Debugging tool to see what's in Pinecone

#### `fetchWithLogging(vectorIds): Promise<any>`
Enhanced fetch with detailed logging for debugging.
- **Parameters:**
  - `vectorIds`: Array of vector IDs
- **Returns:** Fetch response
- **Logging:** Logs request details and result counts
- **Debug Helper:** Calls debugVectorIds if no results found

#### `describeIndexStats(): Promise<any>`
Gets Pinecone index statistics.
- **Returns:** Index stats (total vectors, dimensions, etc.)
- **Usage:** Monitoring and debugging

### Private Functions

#### `validateEnvironment(): void`
Validates required environment variables at initialization.
- **Required:** PINECONE_API_KEY, PINECONE_INDEX, OPENAI_API_KEY
- **Throws:** Error if any are missing

---

## Intelligent QA Service

**Purpose:** Main orchestrator for intelligent question-answering with automatic pipeline routing.

### Functions

#### `generateAnswer(noteId, userId, question): Promise<IntelligentQAResponse>`
Generates an answer using the appropriate pipeline (RAG, external, or hybrid).
- **Parameters:**
  - `noteId`: The note context
  - `userId`: The user's ID
  - `question`: The question to answer
- **Returns:** Object with answer, sources, pipeline_used, intent_classification, confidence
- **Process:**
  1. Builds domain context (attached documents, note content)
  2. Classifies intent (in-domain, out-of-domain, hybrid)
  3. Routes to appropriate pipeline:
     - `rag_only`: Document-based search
     - `external_only`: General knowledge AI
     - `hybrid`: Combined approach
  4. Returns unified response
- **Error Handling:** Returns fallback answer on error

#### `generateAnswerStreaming(noteId, userId, question, onChunk): Promise<IntelligentQAResponse>`
Streaming version of answer generation.
- **Parameters:**
  - `noteId`: The note context
  - `userId`: The user's ID
  - `question`: The question
  - `onChunk`: Callback function for streaming chunks (chunk, isComplete)
- **Returns:** Final response object
- **Process:**
  1. Classifies intent (non-streaming)
  2. Routes to streaming pipeline
  3. Calls onChunk for each chunk
  4. Signals completion with empty chunk and isComplete=true

### Private Pipeline Handlers

#### `handleRAGOnlyPipeline(noteId, userId, question, intentResult): Promise<IntelligentQAResponse>`
Routes to document-only search using native QA service.
- **When:** Query can be answered from user's documents
- **Confidence:** 0.8 if successful, 0.2 if no results

#### `handleExternalOnlyPipeline(question, intentResult, domainContext): Promise<IntelligentQAResponse>`
Routes to general knowledge AI.
- **When:** Query requires external knowledge
- **Confidence:** Based on external service confidence

#### `handleHybridPipeline(noteId, question, intentResult, domainContext): Promise<IntelligentQAResponse>`
Routes to hybrid service combining documents and external knowledge.
- **When:** Query benefits from both sources
- **Confidence:** Weighted average of document and external confidence

#### `handleRAGOnlyPipelineStreaming(...)`: Streaming RAG pipeline
#### `handleExternalOnlyPipelineStreaming(...)`: Streaming external pipeline
#### `handleHybridPipelineStreaming(...)`: Streaming hybrid pipeline

#### `buildDomainContext(noteId, userId): Promise<DomainContext>`
Builds context object for intent classification.
- **Returns:** Object with:
  - `noteId`: The note ID
  - `attachedDocuments`: Array of attached document names/types
  - `noteContent`: "Yes" or "No" indicator
  - `projectDomain`: Domain hint (currently "General")

---

## Intent Classification Service

**Purpose:** Determines which QA pipeline to use based on query analysis.

### Functions

#### `classifyIntent(query, domainContext): Promise<IntentClassificationResult>`
Classifies query intent and determines appropriate pipeline.
- **Parameters:**
  - `query`: The user's question
  - `domainContext`: Context about available documents
- **Returns:** Object with:
  - `intent`: "in_domain", "out_of_domain", or "hybrid"
  - `confidence`: 0.0 to 1.0
  - `domain_topics`: Array of relevant topics
  - `suggested_pipeline`: "rag_only", "external_only", or "hybrid"
  - `reasoning`: Explanation of decision
- **AI Model:** Uses gpt-4o-mini with JSON response format
- **Fallback:** Uses heuristics if AI fails

#### `extractDomainTopics(documentContents: string[]): Promise<string[]>`
Extracts main topics from document content.
- **Parameters:**
  - `documentContents`: Array of document text
- **Returns:** Array of topic strings
- **AI Model:** Uses gpt-4o-mini
- **Usage:** Helps classify queries and enhance answers
- **Limit:** Combines up to 4000 characters of content

### Private Functions

#### `buildClassificationPrompt(query, context): string`
Builds prompt for intent classification with examples and definitions.

#### `fallbackClassification(query, context): IntentClassificationResult`
Heuristic-based classification when AI is unavailable.
- **Checks:**
  - Document-specific keywords ("document", "note", "pdf", etc.)
  - General knowledge keywords ("what is", "define", etc.)
- **Logic:** Prefers document grounding when documents are available

---

## Native QA Service

**Purpose:** Document-based RAG pipeline using vector search for question answering.

### Functions

#### `generateQA(data: QAData): Promise<QAResponse>`
Generates an answer from document search (non-streaming).
- **Parameters:**
  - `data.noteId`: The note context
  - `data.userId`: The user's ID
  - `data.question`: The question
- **Returns:** Object with success flag, answer, and optional error
- **Process:**
  1. Verifies note access
  2. Searches for relevant chunks (top 3)
  3. Generates answer with citations
- **Citations:** Includes author, year, source file when available

#### `generateQAStreaming(data, onChunk): Promise<QAResponse>`
Streaming version of document-based QA.
- **Parameters:**
  - `data`: QA data object
  - `onChunk`: Callback for chunks
- **Returns:** Final response object
- **Process:**
  1. Searches for relevant chunks
  2. Streams answer generation
  3. Appends citations after answer
  4. Signals completion

### Private Functions

#### `generateAnswer(question, searchResults): Promise<string>`
Generates answer from search results with citations.
- **Prompt:** Instructs AI to be brief (2-3 sentences) and cite naturally
- **Format:** Appends sources section if citations found

#### `generateStreamingAnswer(question, searchResults, onChunk): Promise<string>`
Streaming version of answer generation.

#### `formatCitation(result): string`
Formats a single citation (e.g., "(Author, 2024)").

#### `generateCitations(searchResults): string`
Creates "Sources:" section with formatted citations.
- **Format:** Markdown list with author, title, source file
- **Deduplication:** Removes duplicate citations

---

## Hybrid QA Service

**Purpose:** Combines document-based RAG with external knowledge for comprehensive answers.

### Functions

#### `generateHybridAnswer(noteId, query, domain_hints?): Promise<HybridQAResponse>`
Generates answer combining documents and external knowledge.
- **Parameters:**
  - `noteId`: The note context
  - `query`: The question
  - `domain_hints`: Optional topic hints
- **Returns:** Object with answer, sources (document + external), method, confidence
- **Process:**
  1. Gets document context (vector search, top 3)
  2. Gets external knowledge (AI)
  3. Combines both using AI with hybrid prompt
- **AI Model:** Uses gpt-4o with temperature 0.3
- **Prompt:** Instructs to distinguish document vs. external sources

#### `generateHybridAnswerStreaming(noteId, query, onChunk, domain_hints?): Promise<HybridQAResponse>`
Streaming version of hybrid answer generation.
- **Parameters:**
  - `noteId`: The note context
  - `query`: The question
  - `onChunk`: Callback for streaming chunks
  - `domain_hints`: Optional topic hints
- **Returns:** Final response object
- **Process:**
  1. Fetches contexts in parallel (non-streaming)
  2. Streams AI response with combined context

### Private Functions

#### `combineAnswers(query, documentResults, externalResult, domain_hints): Promise<string>`
Combines document and external contexts intelligently.
- **Sections:** Creates "Document Context" and "External Knowledge" sections
- **Prompt:** Unified coherent answer with clear source attribution

#### `buildHybridPrompt(query, documentContext, externalContext, domain_hints): string`
Builds comprehensive prompt for hybrid answer generation.
- **Instructions:**
  - Distinguish document vs. external sources
  - Use proper citations
  - Acknowledge conflicts or complementary info
  - Structure logically
  - End with "Sources" section

#### `calculateHybridConfidence(documentResults, externalResult): number`
Calculates weighted confidence score.
- **Weights:** 70% document / 30% external when documents available
- **Fallback:** 30% document / 70% external when no documents

---

## External Knowledge Service

**Purpose:** Handles queries requiring general knowledge or external information.

### Functions

#### `generateExternalAnswer(query, domain_hints?): Promise<ExternalKnowledgeResponse>`
Generates answer using general AI knowledge.
- **Parameters:**
  - `query`: The question
  - `domain_hints`: Optional topic hints
- **Returns:** Object with answer, sources, confidence, method
- **AI Model:** Uses gpt-4o with temperature 0.3
- **Sources:** Labels as "General AI Knowledge" and "OpenAI GPT-4"
- **Confidence:** 0.8 for successful answers
- **Limitations:** Acknowledges knowledge cutoff and lack of real-time data

#### `generateExternalAnswerStreaming(query, onChunk, domain_hints?): Promise<ExternalKnowledgeResponse>`
Streaming version of external knowledge generation.
- **Parameters:**
  - `query`: The question
  - `onChunk`: Callback for streaming chunks
  - `domain_hints`: Optional topic hints
- **Returns:** Final response object
- **Process:** Streams AI response token by token

#### `generateWithWebSearch(query, domain_hints?): Promise<ExternalKnowledgeResponse>`
Placeholder for future web search integration.
- **Status:** Not implemented (falls back to general AI)
- **Future APIs:** Bing, Google Custom Search, Tavily, Perplexity

#### `generateWithAcademicSearch(query, domain_hints?): Promise<ExternalKnowledgeResponse>`
Placeholder for future academic search integration.
- **Status:** Not implemented (falls back to general AI)
- **Future APIs:** Semantic Scholar, arXiv, PubMed, CrossRef

#### `determineExternalMethod(query, domain_hints?): 'web_search' | 'general_ai' | 'academic_search'`
Determines best external method based on query keywords.
- **Academic:** Research, study, paper, journal, scientific, theory
- **Web Search:** Recent, latest, current, today, what is, who is
- **General AI:** Default fallback

### Private Functions

#### `buildExternalKnowledgeSystemPrompt(domain_hints): string`
Builds system prompt with guidelines for factual, educational responses.
- **Guidelines:**
  - Be factual and acknowledge knowledge cutoff
  - Structure clearly with examples
  - Acknowledge uncertainty
  - Don't make up facts or dates

---

## Todo Service

**Purpose:** Manages user todo items.

### Functions

#### `getUserTodos(userId: string): Promise<Todo[]>`
Retrieves all todos for a user.
- **Parameters:**
  - `userId`: The user's ID
- **Returns:** Array of todos
- **Ordering:**
  1. By completion status (incomplete first)
  2. By due date (earliest first)
  3. By creation date (newest first)

#### `createTodo(data: CreateTodoData): Promise<Todo>`
Creates a new todo.
- **Parameters:**
  - `data.title`: Todo title
  - `data.userId`: The user's ID
  - `data.dueDate`: Optional due date (ISO string or DateTime)
- **Returns:** Created todo
- **Defaults:** isCompleted = false

#### `updateTodo(todoId, data: UpdateTodoData, userId): Promise<Todo>`
Updates a todo.
- **Parameters:**
  - `todoId`: The todo ID
  - `data`: Object with title, isCompleted, and/or dueDate
  - `userId`: The user's ID
- **Returns:** Updated todo
- **Authorization:** Verifies ownership
- **Date Handling:** Converts ISO strings to DateTime

#### `deleteTodo(todoId, userId): Promise<void>`
Deletes a todo.
- **Parameters:**
  - `todoId`: The todo ID
  - `userId`: The user's ID
- **Authorization:** Verifies ownership

#### `toggleTodoComplete(todoId, userId): Promise<Todo>`
Toggles todo completion status.
- **Parameters:**
  - `todoId`: The todo ID
  - `userId`: The user's ID
- **Returns:** Updated todo
- **Authorization:** Verifies ownership

#### `getTodoById(todoId, userId): Promise<Todo>`
Retrieves a specific todo.
- **Parameters:**
  - `todoId`: The todo ID
  - `userId`: The user's ID
- **Returns:** Todo
- **Authorization:** Verifies ownership
- **Throws:** Error if not found

---

## JWKS Service

**Purpose:** Centralized JWT verification using Supabase JWKS for ES256 tokens.

### Functions

#### `getInstance(): JWKSService`
Gets singleton instance of JWKS service.
- **Returns:** Singleton instance
- **Pattern:** Lazy initialization

#### `verifyToken(token: string): Promise<JWTPayload>`
Verifies JWT token and returns payload.
- **Parameters:**
  - `token`: JWT token string
- **Returns:** Decoded JWT payload
- **Process:**
  1. Verifies signature using JWKS
  2. Validates issuer (Supabase)
  3. Validates audience ("authenticated")
  4. Only accepts ES256 algorithm
- **Caching:** jose library handles JWKS caching automatically
- **Logging:** Minimal logging (debug mode only)
- **Error:** Throws detailed error on verification failure

#### `verifyTokenAndGetUser(token: string): Promise<{payload, user, userId}>`
Verifies token and resolves/creates local user.
- **Parameters:**
  - `token`: JWT token string
- **Returns:** Object with:
  - `payload`: JWT payload
  - `user`: User model instance
  - `userId`: User's local database ID
- **Process:**
  1. Verifies token
  2. Extracts Supabase UID (sub claim)
  3. Looks up user by supabaseUid
  4. Creates user if not found
- **Auto-Create:** New users are automatically created on first login

#### `getSupabaseConfig(): Record<string, any>`
Gets Supabase configuration for debugging.
- **Returns:** Object with:
  - `jwksUrl`: JWKS endpoint URL
  - `issuer`: Expected issuer
  - `audience`: Expected audience
  - `jwksUrlValid`: Boolean indicating valid URL format
  - `issuerValid`: Boolean indicating valid issuer URL format
- **Usage:** Debugging authentication issues

### Private Functions

#### `validateEnvironment(): void`
Validates required environment variables at construction.
- **Required:**
  - SUPABASE_JWKS_URL
  - SUPABASE_JWT_ISS
  - SUPABASE_JWT_AUD

#### `isValidUrl(str: string): boolean`
Checks if string is a valid URL.

### Configuration

- **Algorithm:** ES256 only (Supabase uses elliptic curve signatures)
- **Singleton:** Uses singleton pattern for efficiency
- **Caching:** JWKS keys are cached by jose library
- **Environment:** Reads from env service at initialization

---

## Service Architecture Patterns

### Common Patterns

1. **Authorization First:** Most services verify access before operations
2. **Error Handling:** Try-catch with descriptive error messages
3. **Transactions:** Database transactions for multi-step operations
4. **Logging:** Console logs with emoji prefixes for easy scanning
5. **Service Composition:** Services call other services for complex operations
6. **Async/Await:** All database and external calls use promises
7. **Type Safety:** TypeScript types for parameters and returns

### Service Dependencies

```
+------------------------------------------+
|         Controllers (HTTP Layer)         |
+--------------------+---------------------+
                     |
                     v
+------------------------------------------+
|            Service Layer                 |
|                                          |
|  +------------------------------------+  |
|  |   AuthorizationService             |<---- Used by all services
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  |   ProjectService                   |  |
|  |   NoteService                      |  |
|  |   LibraryService                   |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  |   AIService                        |  |
|  |   FlashcardService                 |  |
|  |   MultipleChoiceService            |  |
|  |   FreeResponseService              |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  |   IntelligentQAService             |  |
|  |     +- IntentClassificationService |  |
|  |     +- NativeQAService             |  |
|  |     +- HybridQAService             |  |
|  |     +- ExternalKnowledgeService    |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  |   NativeVectorService              |  |
|  |     +- NativePineconeService       |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  |   JWKSService (Singleton)          |  |
|  |   TodoService                      |  |
|  +------------------------------------+  |
+--------------------+---------------------+
                     |
                     v
+------------------------------------------+
|    External Services & Databases         |
|  - PostgreSQL (Lucid ORM)                |
|  - Supabase Auth (JWKS)                  |
|  - OpenAI (Embeddings & Chat)            |
|  - Pinecone (Vector DB)                  |
|  - AWS S3 (File Storage)                 |
+------------------------------------------+
```

### Security Principles

1. **Multi-Layer Authorization:**
   - Project level (userId � projectId)
   - Note level (userId � noteId)
   - Vector level (userId + projectId + noteId)

2. **User Isolation:**
   - All queries filtered by userId
   - Supabase JWT provides user identity
   - No cross-user data leakage

3. **Resource Ownership:**
   - Authorization service validates ownership
   - Services throw errors for unauthorized access
   - Controllers handle authorization errors

4. **Global Resources:**
   - Library items can be marked global
   - Global items accessible to all users
   - Owner-only modification

### Performance Optimizations

1. **Batch Operations:**
   - Vector upserts in batches of 100
   - Embedding generation for multiple chunks at once
   - Database bulk inserts with transactions

2. **Selective Loading:**
   - Summary queries (id, name only) for lists
   - Preloading relationships to avoid N+1 queries
   - Limit recent items to 20 for performance

3. **Caching:**
   - JWKS keys cached by jose library
   - Pinecone queries use metadata filters for speed

4. **Async Parallelization:**
   - Multiple independent operations run in parallel
   - Promise.all for concurrent data fetching

---

## Usage Examples

### Creating a Project with Notes

```typescript
const projectService = new ProjectService()
const noteService = new NoteService()

// Create project
const project = await projectService.createProject({
  userId: 'user-123',
  name: 'Biology Studies',
  description: 'My biology notes',
  color: '#4CAF50'
})

// Create note in project
const { note, treeNode } = await noteService.createNote({
  userId: 'user-123',
  projectId: project.id,
  name: 'Cell Biology',
  content: '# Cell Biology\n\n...',
  folderPath: [] // Root level
})
```

### Generating Flashcards

```typescript
const aiService = new AIService()

const result = await aiService.generateFlashcardSet({
  flashcardSetId: 'set-123',
  userId: 'user-123',
  projectId: 'project-123',
  selectedNoteIds: ['note-1', 'note-2'],
  selectedLibraryItemIds: ['lib-1']
})

console.log(`Generated ${result.flashcardsCount} flashcards`)
```

### Intelligent Q&A

```typescript
const qaService = new IntelligentQAService()

// Non-streaming
const response = await qaService.generateAnswer(
  'note-123',
  'user-123',
  'What is photosynthesis?'
)

console.log(response.answer)
console.log('Pipeline used:', response.pipeline_used)
console.log('Sources:', response.sources)

// Streaming
await qaService.generateAnswerStreaming(
  'note-123',
  'user-123',
  'What is photosynthesis?',
  (chunk, isComplete) => {
    if (chunk) process.stdout.write(chunk)
    if (isComplete) console.log('\n[Complete]')
  }
)
```

### Vector Search

```typescript
const vectorService = new NativeVectorService()

// Vectorize a note
await vectorService.vectorizeNote('note-123')

// Vectorize a library item
await vectorService.vectorizeLibraryItem('lib-123')

// Search for relevant content
const results = await vectorService.searchForQA(
  'note-123',
  'What causes photosynthesis?',
  5
)

results.forEach(result => {
  console.log(`Score: ${result.score}`)
  console.log(`Content: ${result.content}`)
  console.log(`Source: ${result.sourceFile}`)
})
```

---

## Environment Variables

Services require the following environment variables:

```bash
# OpenAI
OPENAI_API_KEY=sk-...
DEFAULT_AI_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small

# Pinecone
PINECONE_API_KEY=...
PINECONE_INDEX=noted-index
VECTOR_CHUNK_SIZE=1000
VECTOR_CHUNK_OVERLAP=200

# AWS S3
NOTED_AWS_REGION=us-east-1
NOTED_AWS_ACCESS_KEY_ID=...
NOTED_AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...

# Supabase Auth
SUPABASE_JWKS_URL=https://....supabase.co/auth/v1/jwks
SUPABASE_JWT_ISS=https://....supabase.co/auth/v1
SUPABASE_JWT_AUD=authenticated

# Application
NODE_ENV=development
LOG_LEVEL=debug  # Optional, for verbose logging
```

---

## Testing Services

Services can be tested using Japa test framework:

```typescript
import { test } from '@japa/runner'
import NoteService from '#services/note_service'

test.group('NoteService', () => {
  test('creates note with default study options', async ({ assert }) => {
    const noteService = new NoteService()

    const { note } = await noteService.createNote({
      userId: 'user-123',
      projectId: 'project-123',
      name: 'Test Note',
      content: 'Test content'
    })

    assert.exists(note.id)
    assert.equal(note.name, 'Test Note')
  })
})
```

---

## Best Practices

1. **Always Use Authorization Service:** Never bypass authorization checks
2. **Use Transactions:** For multi-step database operations
3. **Handle Errors Gracefully:** Provide descriptive error messages
4. **Log Important Events:** Use emoji prefixes for scanability
5. **Validate Input:** Use Vine validators before service layer
6. **Type Everything:** Leverage TypeScript for safety
7. **Keep Services Focused:** Single responsibility principle
8. **Document Public Methods:** Especially complex algorithms
9. **Test Edge Cases:** Empty content, missing associations, etc.
10. **Consider Performance:** Use batch operations and selective loading

---

## Future Improvements

1. **Web Search Integration:** ExternalKnowledgeService placeholders
2. **Academic Search:** Semantic Scholar, arXiv integration
3. **S3 File Cleanup:** Delete S3 files when library items deleted
4. **Real-time Updates:** WebSocket notifications for long operations
5. **Caching Layer:** Redis for frequently accessed data
6. **Rate Limiting:** OpenAI and Pinecone API rate limiting
7. **Retry Logic:** Exponential backoff for external API failures
8. **Metrics:** Service-level performance monitoring
9. **Audit Logs:** Track important operations for compliance
10. **Service Tests:** Comprehensive unit and integration tests