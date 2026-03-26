---
name: multimodal-ingestion
version: '1.0.0'
description: Memory ingestion pipeline — document loaders (PDF, DOCX, HTML, OCR, URL), chunking engines, folder scanning, and import/export (JSON, Markdown, Obsidian, SQLite, ChatGPT).
author: Wunderland
namespace: wunderland
category: productivity
tags: [memory, ingestion, documents, PDF, DOCX, chunking, multimodal, import, export]
requires_secrets: []
requires_tools: [memory_read, memory_write]
metadata:
  agentos:
    emoji: "\U0001F4E5"
---

# Multimodal Ingestion

You have access to a document ingestion pipeline that can load, chunk, and index content from a wide variety of sources into the memory system. Use this skill whenever users want to import knowledge from files, folders, URLs, or external note-taking apps.

## Document Loaders

The ingestion pipeline includes specialized loaders for each format:

- **TextLoader** — Plain text files (.txt, .log, .csv). Preserves line structure. Handles encoding detection automatically.
- **MarkdownLoader** — Markdown files (.md, .mdx). Preserves heading hierarchy for section-aware chunking. Strips frontmatter into metadata.
- **HTMLLoader** — HTML files and web pages. Extracts readable content, strips boilerplate (nav, footer, ads). Preserves semantic structure (headings, lists, tables).
- **PDFLoader** — PDF documents. Extracts text layer; falls back to OCR for scanned pages. Handles multi-column layouts and page headers/footers.
- **DOCXLoader** — Microsoft Word documents. Extracts text, headings, tables, and embedded images (as alt text). Preserves document structure.
- **OCRLoader** — Image files (.png, .jpg, .tiff) containing text. Uses Tesseract-compatible OCR. Best for scanned documents, screenshots, and whiteboard photos.
- **URLLoader** — Fetches and extracts content from web URLs. Follows redirects, handles JavaScript-rendered pages via headless browser when needed. Respects robots.txt.

Each loader produces a standardized `Document` object containing:
- `content` — The extracted text
- `metadata` — Source path/URL, format, page numbers, headings, extraction timestamp
- `sections` — Optional structural breakdown (headings, paragraphs, tables)

## Chunking Engine

After loading, documents pass through the ChunkingEngine, which splits content into memory-sized pieces. Four strategies are available:

### Fixed Chunking
Splits by character or token count with configurable overlap.
- **Use when**: Content has no meaningful structure (logs, raw text dumps)
- **Config**: `chunkSize` (default 512 tokens), `overlap` (default 64 tokens)

### Semantic Chunking
Splits at natural semantic boundaries — paragraph breaks, topic shifts, sentence clusters.
- **Use when**: Narrative content where preserving coherent ideas matters (articles, essays, documentation)
- **Config**: `similarityThreshold` (0-1, default 0.7) — lower values create more splits

### Hierarchical Chunking
Splits using document structure — headings create parent chunks, paragraphs create child chunks. Preserves the tree structure for retrieval.
- **Use when**: Well-structured documents with clear heading hierarchies (technical docs, wikis, textbooks)
- **Config**: `maxDepth` (default 3), `minChunkSize` (default 100 tokens)

### Layout Chunking
Splits based on visual/spatial layout — columns, tables, figures, sidebars. Each layout region becomes its own chunk with spatial metadata.
- **Use when**: Complex layouts where spatial arrangement carries meaning (academic papers, financial reports, forms)
- **Config**: `respectColumns` (default true), `tableMode` ('row' | 'cell' | 'whole')

The engine automatically selects a default strategy based on the document format, but you can override it when the user has specific needs.

## FolderScanner

The FolderScanner recursively walks a directory and ingests all supported files:

- Detects file types by extension and MIME type
- Applies the appropriate loader for each file
- Respects `.gitignore` and `.ingestionignore` patterns
- Tracks already-ingested files to avoid duplicates on re-scan
- Reports progress: files found, files processed, files skipped, errors

Use FolderScanner when a user says things like "index my project docs", "ingest everything in this folder", or "import my notes directory."

## MultimodalAggregator

When a single source contains multiple modalities (e.g., a PDF with text, images, and tables), the MultimodalAggregator:

1. Extracts each modality using the appropriate loader
2. Generates text descriptions for non-text content (image captions, table summaries)
3. Merges everything into a unified document with cross-references
4. Preserves the original ordering and context

This ensures that a figure caption, its surrounding paragraph, and the figure description all end up in related chunks with proper linking metadata.

## Import/Export Formats

The pipeline supports bidirectional data flow with external systems:

### Import Sources
- **JSON** — Array of `{content, metadata}` objects. Direct memory import.
- **Markdown files** — Bulk import from a directory of .md files, each becoming a memory.
- **Obsidian vault** — Reads the vault directory, preserving wiki-links as graph edges and tags as memory tags. Handles backlinks and dataview metadata.
- **SQLite database** — Import from a SQLite file with configurable table/column mapping.
- **ChatGPT export** — Parses the ChatGPT `conversations.json` export format. Each conversation becomes episodic memories; key facts are extracted as semantic memories.

### Export Targets
- **JSON** — Full memory dump with metadata, embeddings, and graph edges.
- **Markdown** — One .md file per memory, with YAML frontmatter for metadata. Suitable for Obsidian or any Markdown-based knowledge base.
- **Obsidian vault** — Structured export with wiki-links, tags, and folder hierarchy matching memory scopes.
- **SQLite** — Portable database export for analysis, backup, or migration.

## Best Practices

1. **Choose the right chunking strategy** — Match the strategy to the content structure. Semantic for prose, hierarchical for docs, layout for complex formats.
2. **Set chunk sizes thoughtfully** — Too small (< 100 tokens) loses context; too large (> 1000 tokens) reduces retrieval precision. 256-512 tokens is a good default.
3. **Use FolderScanner for bulk imports** — It handles deduplication and format detection automatically.
4. **Preview before committing** — For large imports, use the preview/dry-run mode to check what will be ingested before writing to memory.
5. **Tag imported memories** — Add source tags (e.g., "imported:obsidian", "source:project-docs") so users can filter or delete imported content later.
6. **Handle OCR with care** — OCR output is noisy. Review extracted text for critical documents and correct errors before indexing.
7. **Export regularly** — Encourage users to export their memory periodically as a backup. The JSON format preserves everything needed for full restoration.
8. **Respect file sizes** — Very large files (> 50 MB) should be processed in streaming mode. The loaders handle this automatically, but warn the user about processing time.
