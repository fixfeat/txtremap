import nzh from 'nzh'

interface ChapterMatch {
  id: number
  number: number
  originalNumber: string
  extendedOriginalNumber: string
  lines: string[]
  lineNumber: number
  skip?: boolean
  invalid?: boolean
}

export type { ChapterMatch }

export async function processTxtFile(text: string): Promise<ChapterMatch[]> {
  const lines = text.split('\n')
  const matches = findChapterNumbers(lines)
  filterInvalidMatches(matches)
  findLongestIncreasingSequence(matches)
  return mergeInvalidMatches(matches)
}

export async function normalizeChapter(text: string): Promise<string> {
  const matches = await processTxtFile(text)
  return buildChapters(matches)
}

function findChapterNumbers(lines: string[]): ChapterMatch[] {
  let index = 0
  let accumulatedLines = 0
  const matches: ChapterMatch[] = [
    {
      id: index,
      number: 0,
      originalNumber: '',
      extendedOriginalNumber: '',
      lines: [],
      lineNumber: 0,
    },
  ]

  const numberPattern = /\d+/
  const chineseNumberPattern = /[零一二三四五六七八九十百千万]+/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    let match: RegExpExecArray | null

    match = numberPattern.exec(line)
    if (match) {
      const number = parseInt(match[0], 10)
      matches.push({
        id: ++index,
        number,
        originalNumber: match[0],
        extendedOriginalNumber: findExtendedOriginalNumber(match[0], line),
        lines: [line],
        lineNumber: accumulatedLines++,
      })
      continue
    }

    match = chineseNumberPattern.exec(line)
    if (match) {
      const number = parseInt(nzh.cn.decodeS(match[0]), 10)
      matches.push({
        id: ++index,
        number,
        originalNumber: match[0],
        extendedOriginalNumber: findExtendedOriginalNumber(match[0], line),
        lines: [line],
        lineNumber: accumulatedLines++,
      })
      continue
    }

    // normal line, push to last chapter
    matches[matches.length - 1].lines.push(line)
    accumulatedLines++
  }

  return matches
}

function findExtendedOriginalNumber(originalNumber: string, line: string): string {
  if (originalNumber.length === 0) {
    return ''
  }

  const pattern1 = new RegExp(`第?${originalNumber}[章回节]?[、\\-:：.]?`)
  const match = pattern1.exec(line)
  if (match) {
    return match[0]
  }

  return originalNumber
}

function filterInvalidMatches(matches: ChapterMatch[]) {
  matches.forEach((match) => {
    const line = match.lines[0]

    if (line.length > 30) {
      match.invalid = true
    }

    const datePattern = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/
    const timePattern = /\d{1,2}:\d{2}(:\d{2})?/
    const combinedPattern = /\d{4}[-/]\d{1,2}[-/]\d{1,2}.*?\d{1,2}:\d{2}(:\d{2})?/

    if (
      isSpecialString(line, datePattern, match.originalNumber) ||
      isSpecialString(line, timePattern, match.originalNumber) ||
      isSpecialString(line, combinedPattern, match.originalNumber)
    ) {
      match.invalid = true
    }

    const specialPuntuation = new RegExp(`${match.originalNumber} ?[!！？?;；"”]`)
    if (isSpecialString(line, specialPuntuation, match.originalNumber)) {
      match.invalid = true
    }

    if (line.indexOf(match.extendedOriginalNumber) > 2) {
      match.invalid = true
    }

    if (match.number <= 0) {
      match.invalid = true
    }

    if (match.number > matches.length + 1000) {
      match.invalid = true
    }

    if (match.invalid) {
      match.skip = true
    }
  })
}

function mergeInvalidMatches(matches: ChapterMatch[]): ChapterMatch[] {
  const filteredMatches = []
  for (const match of matches) {
    if (!match.invalid || match.id === 0) {
      filteredMatches.push(match)
    } else {
      filteredMatches[filteredMatches.length - 1].lines.push(...match.lines)
    }
  }
  return filteredMatches
}

function isSpecialString(str: string, pattern: RegExp, originalNumber: string): boolean {
  return pattern.exec(str)?.[0].includes(originalNumber) || false
}

function findLongestIncreasingSequence(matches: ChapterMatch[]) {
  if (matches.length === 0) {
    return []
  }

  const n = matches.length
  const dp: number[] = new Array(n).fill(1)
  const prev: number[] = new Array(n).fill(-1)

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (
        matches[j].number < matches[i].number &&
        dp[j] + 1 > dp[i] &&
        !matches[i].skip &&
        !matches[j].skip
      ) {
        dp[i] = dp[j] + 1
        prev[i] = j
      }
    }
  }

  let maxLength = 0
  let maxIndex = 0
  for (let i = 0; i < n; i++) {
    if (dp[i] > maxLength) {
      maxLength = dp[i]
      maxIndex = i
    }
  }

  const sequence: ChapterMatch[] = []
  let current = maxIndex
  while (current !== -1) {
    sequence.unshift(matches[current])
    current = prev[current]
  }

  // deduplicate sequence
  const seenNumbers = new Map<number, ChapterMatch>()
  for (const match of sequence) {
    seenNumbers.set(match.number, match)
  }
  const finalIndices = Array.from(seenNumbers.values()).map((match) => match.id)

  let lastSeqNumber = 0
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    if (match.id !== 0 && !finalIndices.includes(match.id)) {
      match.skip = true
      if (match.number > lastSeqNumber + 300 || match.number < lastSeqNumber - 10) {
        match.invalid = true
      }
    }
    if (!match.skip && !match.invalid) {
      lastSeqNumber = match.number
    }
  }
}

export function buildChapters(matches: ChapterMatch[]): string {
  if (matches.length === 0) {
    return ''
  }

  const chapters: Array<{ title: string; content: string }> = []

  let title = ''
  let lines: string[] = []
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    if (match.skip) {
      lines.push(...match.lines)
      continue
    }
    // 当前match进入下一章，处理上一章
    if (title !== '' || lines.length > 0) {
      chapters.push({ title, content: lines.join('\n') })
      lines = []
    }

    // 新章节
    title = match.number > 0 ? `第${match.number}章` : ''
    lines.push(match.lines[0].replace(match.extendedOriginalNumber, '').trim(), ...match.lines.slice(1))
  }

  // 处理最后一章
  if (title !== '' || lines.length > 0) {
    chapters.push({ title, content: lines.join('\n') })
  }

  return formatChapters(chapters)
}

function formatChapters(chapters: Array<{ title: string; content: string }>): string {
  return chapters
    .map((chapter) => {
      if (chapter.title === '') {
        return chapter.content
      }
      return `${chapter.title} ${chapter.content}`
    })
    .join('\n\n')
}
