<script lang="ts">
  import { processTxtFile, buildChapters, type ChapterMatch } from '$lib/algo/txtremap'

  let fileContent = $state('')
  let allLines = $state<string[]>([])
  let matches = $state<ChapterMatch[]>([])
  let isProcessing = $state(false)

  let highlightedLine = $state<number | null>(null)
  let highlightTimeoutId = $state<ReturnType<typeof setTimeout> | null>(null)

  let scrollContainerRef = $state<HTMLDivElement | null>(null)
  let chapterListRef = $state<HTMLDivElement | null>(null)

  const LINE_HEIGHT = 24
  const VISIBLE_LINES = 100
  const OVERSCAN = 10

  const CHAPTER_ITEM_HEIGHT = 36
  const VISIBLE_CHAPTERS = 50
  const CHAPTER_OVERSCAN = 5

  let scrollIndex = $state(0)
  let chapterScrollIndex = $state(0)
  let visibleLines = $derived(
    allLines.slice(Math.max(0, scrollIndex - OVERSCAN), scrollIndex + VISIBLE_LINES + OVERSCAN)
  )
  let startLineIndex = $derived(Math.max(0, scrollIndex - OVERSCAN))

  let visibleChapters = $derived(
    matches.slice(
      Math.max(0, chapterScrollIndex - CHAPTER_OVERSCAN),
      chapterScrollIndex + VISIBLE_CHAPTERS + CHAPTER_OVERSCAN
    )
  )
  let startChapterIndex = $derived(Math.max(0, chapterScrollIndex - CHAPTER_OVERSCAN))

  let isDragging = $state(false)

  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    await processFile(file)
  }

  async function processFile(file: File) {
    isProcessing = true
    try {
      const text = await file.text()
      fileContent = text
      allLines = text.split('\n')
      matches = await processTxtFile(text)
    } catch (error) {
      console.error('Error processing file:', error)
    } finally {
      isProcessing = false
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    isDragging = true
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    isDragging = false
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    isDragging = false

    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    processFile(file)
  }

  function toggleSkip(id: number) {
    const match = matches.find((match) => match.id === id)
    if (!match) return
    match.skip = !match.skip
  }

  function onScroll() {
    if (!scrollContainerRef) return
    scrollIndex = Math.floor(scrollContainerRef.scrollTop / LINE_HEIGHT)
  }

  function onChapterScroll() {
    if (!chapterListRef) return
    chapterScrollIndex = Math.floor(chapterListRef.scrollTop / CHAPTER_ITEM_HEIGHT)
  }

  function jumpToChapter(id: number) {
    if (!scrollContainerRef) return

    const match = matches.find((match) => match.id === id)
    if (!match) return

    highlightedLine = match.lineNumber
    if (highlightTimeoutId) {
      clearTimeout(highlightTimeoutId)
    }
    highlightTimeoutId = setTimeout(() => {
      highlightedLine = null
      highlightTimeoutId = null
    }, 1000)

    scrollContainerRef.scrollTo({
      top: (match.lineNumber - 1) * LINE_HEIGHT,
      behavior: 'smooth',
    })
  }

  async function downloadFormatted() {
    const formatted = buildChapters(matches)
    const blob = new Blob([formatted], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'formatted_chapters.txt'
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<div
  class="min-h-screen {isDragging ? 'bg-blue-50' : 'bg-gray-50'}"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="文件上传区域"
>
  <header class="bg-white shadow-sm">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
      <h1 class="text-2xl font-bold text-gray-900">TXT 章节格式化工具</h1>
      <div class="flex items-center gap-4">
        <label
          class="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <span>上传 TXT 文件</span>
          <input type="file" accept=".txt" onchange={handleFileUpload} class="hidden" />
        </label>
        {#if matches.length > 0}
          <button
            onclick={downloadFormatted}
            class="rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
          >
            下载格式化文件
          </button>
        {/if}
      </div>
    </div>
  </header>

  {#if isProcessing}
    <div class="flex items-center justify-center py-20">
      <div class="text-gray-600">正在处理文件...</div>
    </div>
  {:else if fileContent === ''}
    <div class="flex items-center justify-center py-20">
      <div class="text-center text-gray-500">
        <svg
          class="mx-auto mb-4 h-16 w-16 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p class="text-lg">请上传一个 TXT 文件开始处理</p>
      </div>
    </div>
  {:else}
    <main
      class="mx-auto grid h-[calc(100vh-72px)] max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-2"
    >
      <div class="flex min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow">
        <div class="shrink-0 border-b border-gray-200 px-4 py-3">
          <h2 class="inline-block text-lg font-medium text-gray-900">文本内容</h2>
        </div>
        <div bind:this={scrollContainerRef} onscroll={onScroll} class="flex-1 overflow-y-auto">
          <div
            class="p-4 font-mono text-sm leading-6"
            style="height: {allLines.length * LINE_HEIGHT}px; position: relative;"
          >
            {#each visibleLines as line, i (i)}
              <div
                class="absolute left-0 w-full overflow-hidden px-3 text-ellipsis whitespace-nowrap transition-colors duration-500 {highlightedLine ===
                startLineIndex + i
                  ? 'bg-yellow-200'
                  : ''}"
                style="top: {(startLineIndex + i) * LINE_HEIGHT}px;height: {LINE_HEIGHT}px;"
              >
                {line}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="flex min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow">
        <div class="shrink-0 border-b border-gray-200 px-4 py-3">
          <h2 class="inline-block text-lg font-medium text-gray-900">
            章节目录 ({matches.filter((m) => !m.skip).length} 个章节)
          </h2>
          <span class="text-sm text-gray-500">（双击章节标题切换状态）</span>
        </div>
        <div
          bind:this={chapterListRef}
          onscroll={onChapterScroll}
          class="flex-1 overflow-y-auto p-4"
        >
          {#if matches.length === 0}
            <p class="py-8 text-center text-gray-500">未检测到章节</p>
          {:else}
            <div class="relative" style="height: {matches.length * CHAPTER_ITEM_HEIGHT}px;">
              {#each visibleChapters as match, i (match.id)}
                <button
                  class="absolute my-1 w-[calc(100%-1rem)] overflow-hidden rounded-md px-2 py-1 text-left text-ellipsis whitespace-nowrap transition-colors {match.skip
                    ? 'bg-gray-100 text-gray-400 opacity-60'
                    : 'bg-blue-50 text-blue-900 hover:bg-blue-100'}"
                  style="top: {(startChapterIndex + i) * CHAPTER_ITEM_HEIGHT}px;"
                  onclick={() => jumpToChapter(match.id)}
                  ondblclick={() => toggleSkip(match.id)}
                >
                  <span class="font-medium">
                    {#if match.id === 0}
                      前言/序章
                    {:else}
                      {match.lines[0]}
                    {/if}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </main>
  {/if}
</div>
