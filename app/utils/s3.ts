import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const REGION = process.env.NOTED_AWS_REGION!
const BUCKET_NAME = process.env.S3_BUCKET_NAME!

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.NOTED_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NOTED_AWS_SECRET_ACCESS_KEY!,
  },
})

export async function getPresignedUrl(fileName: string, fileType: string) {
  if (!BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME is not set in environment')
  }

  const key = `library/${Date.now()}_${fileName}`
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
  })

  // 10 minutes expiration (600 seconds)
  const expiresIn = 600
  const presignedUrl = await getSignedUrl(s3, command, { expiresIn })

  return {
    presignedUrl,
    key,
    expiresIn,
  }
}

export async function getPresignedViewUrl(key: string) {
  if (!BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME is not set in environment')
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  // 10 minutes expiration (600 seconds)
  const expiresIn = 600
  const presignedUrl = await getSignedUrl(s3, command, { expiresIn })

  return {
    presignedUrl,
    expiresIn,
  }
}
