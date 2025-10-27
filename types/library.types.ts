/**
 * Library Types
 * Types related to library items and file management
 */

export interface CreateLibraryItemData {
  projectId: string
  key: string
  fileName: string
  fileType: string
  size: number
  isGlobal?: boolean
  userId: string
}

export interface PresignedUrlData {
  fileName: string
  fileType: string
}

export interface PresignedUrlResponse {
  presignedUrl: string
  key: string
  expiresIn: number
}
