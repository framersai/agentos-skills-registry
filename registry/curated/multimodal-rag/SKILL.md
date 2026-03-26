---
name: multimodal-rag
description: Index and search across text, images, audio, video, and PDFs
version: 1.0.0
tags: [rag, multimodal, image, audio, video, pdf, search]
tools_required: [vision-pipeline]
---

# Multimodal RAG

Index and retrieve content across all modalities -- text, images, audio, video, and PDFs. Images are described via vision AI, audio is transcribed, video frames are extracted, and PDFs are parsed. All content is embedded and searchable.

## Capabilities
- **Image indexing**: Vision LLM describes -> embed -> search
- **Audio indexing**: STT transcribes -> embed -> search
- **Video indexing**: Frame extraction + audio transcription
- **PDF indexing**: Text + embedded image extraction
- **Cross-modal search**: Query returns results from all modalities

## Example
"Find images related to quantum computing"
"Search my audio recordings for mentions of the project deadline"
"What does the diagram in page 3 of the PDF show?"
