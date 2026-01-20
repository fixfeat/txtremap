import * as fs from 'fs'
import * as path from 'path'
import { normalizeChapter } from '../txtremap'

async function parseFile(inputPath: string, outputPath?: string): Promise<void> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`)
  }

  const content = fs.readFileSync(inputPath, 'utf-8')

  const normalizedContent = await normalizeChapter(content)

  const defaultOutputPath = path.join(
    path.dirname(inputPath),
    path.basename(inputPath, path.extname(inputPath)) + '_normalized' + path.extname(inputPath)
  )

  const finalOutputPath = outputPath || defaultOutputPath

  fs.writeFileSync(finalOutputPath, normalizedContent, 'utf-8')

  console.log(`Successfully normalized chapters from ${inputPath} to ${finalOutputPath}`)
}

parseFile('src/lib/algo/local/example.txt')
