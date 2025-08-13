import { GetObjectCommand } from '@aws-sdk/client-s3'
import { S3Client } from '@aws-sdk/client-s3'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import env from '#start/env'
import { Readable } from 'node:stream'

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.get('NOTED_AWS_REGION')!,
      credentials: {
        accessKeyId: env.get('NOTED_AWS_ACCESS_KEY_ID')!,
        secretAccessKey: env.get('NOTED_AWS_SECRET_ACCESS_KEY')!,
      },
    })
  }
  return s3Client
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
    const pdfDocument = await loadingTask.promise

    console.log(`📖 PDF has ${pdfDocument.numPages} pages`)

    let fullText = ''

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum)
      const textContent = await page.getTextContent()

      const pageText = textContent.items.map((item: any) => item.str).join(' ')

      fullText += pageText + '\n'
    }

    return fullText
  } catch (error) {
    console.error('❌ Error parsing PDF with pdfjs:', error)
    throw error
  }
}

export async function downloadAndExtractText(s3Key: string): Promise<string> {
  const bucketName = env.get('S3_BUCKET_NAME')
  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is required')
  }

  console.log(`📦 Downloading from S3: s3://${bucketName}/${s3Key}`)

  try {
    const client = getS3Client()
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    })

    const response = await client.send(command)

    if (!response.Body) {
      throw new Error('No body in S3 response')
    }

    // Convert the readable stream to a buffer
    const buffer = await streamToBuffer(response.Body as Readable)
    console.log('✅ File downloaded successfully from S3')

    // Check if the file is a PDF and extract text
    if (s3Key.toLowerCase().endsWith('.pdf')) {
      console.log('📄 File identified as PDF, extracting text...')
      try {
        const text = await extractTextFromPDF(buffer)
        console.log(`✅ Text extraction completed - ${text.length} characters extracted`)
        return text
      } catch (error) {
        console.error('❌ Error extracting text from PDF:', error)
        throw error
      }
    } else {
      console.log('❌ File is not a PDF - unsupported file type')
      throw new Error('Unsupported file type. Only PDF files are supported.')
    }
  } catch (error) {
    console.error('❌ Error downloading from S3:', error)
    throw error
  }
}
