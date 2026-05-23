'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import FileUpload from './FileUpload';
import type { PromptTemplate, ProviderCapabilities } from '@/types/chat';

type SendResult = boolean | void | Promise<boolean | void>;

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string, files?: File[]) => SendResult;
  onStop?: () => void;
  isLoading: boolean;
  templates: PromptTemplate[];
  providerCapabilities: ProviderCapabilities;
}

interface SelectedAttachment {
  file: File;
  previewUrl?: string;
}

interface SlashRange {
  start: number;
  end: number;
}

export default function InputArea({ value, onChange, onSend, onStop, isLoading, templates, providerCapabilities }: InputAreaProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [slashRange, setSlashRange] = useState<SlashRange | null>(null);
  const [highlightedTemplateIndex, setHighlightedTemplateIndex] = useState(0);
  const selectedFilesRef = useRef<SelectedAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const slashQuery = slashRange ? value.slice(slashRange.start + 1, slashRange.end).toLowerCase() : '';
  const filteredTemplates = useMemo(() => {
    if (!slashRange) return [];
    return templates.filter(template => {
      const title = template.title.toLowerCase();
      const content = template.content.toLowerCase();
      return title.includes(slashQuery) || content.includes(slashQuery);
    });
  }, [slashQuery, slashRange, templates]);
  const activeTemplateIndex = Math.min(
    highlightedTemplateIndex,
    Math.max(filteredTemplates.length - 1, 0)
  );

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      selectedFilesRef.current.forEach(revokePreviewUrl);
    };
  }, []);

  const clearSelectedFiles = (files = selectedFiles) => {
    files.forEach(revokePreviewUrl);
    setSelectedFiles([]);
  };

  const handleSend = async () => {
    if (isLoading || (!value.trim() && selectedFiles.length === 0)) return;

    const filesToSend = selectedFiles.map(selected => selected.file);
    const accepted = await onSend(value.trim(), filesToSend.length > 0 ? filesToSend : undefined);

    if (accepted !== false) {
      clearSelectedFiles();
      closeTemplatePicker();
    }
  };

  const handleDraftChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    onChange(nextValue);
    updateTemplatePicker(nextValue, event.target.selectionStart);
  };

  const handleSelectionChange = () => {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    updateTemplatePicker(value, cursor);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashRange && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return;
    handleSelectionChange();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashRange) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedTemplateIndex(index => wrapTemplateIndex(index + 1, filteredTemplates.length));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedTemplateIndex(index => wrapTemplateIndex(index - 1, filteredTemplates.length));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const template = filteredTemplates[activeTemplateIndex];
        if (template) {
          insertTemplate(template);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeTemplatePicker();
        return;
      }
    }

    if (event.key === 'Escape' && isLoading) {
      event.preventDefault();
      event.stopPropagation();
      onStop?.();
      return;
    }

    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || !event.shiftKey)) {
      event.preventDefault();
      void handleSend();
    }
  };

  useEffect(() => {
    if (!isLoading || !onStop) return;

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onStop();
    };

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown);
  }, [isLoading, onStop]);

  const handleFilesSelected = async (files: File[]) => {
    setAttachmentError(null);

    const nextImageAttachments: SelectedAttachment[] = [];
    const textSnippets: string[] = [];

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        if (!providerCapabilities.supportsAttachments || !providerCapabilities.supportsImages) {
          setAttachmentError('Image attachments are disabled for the active provider.');
          continue;
        }

        if (file.size > providerCapabilities.maxImageAttachmentBytes) {
          setAttachmentError(`Image attachments must be ${formatBytes(providerCapabilities.maxImageAttachmentBytes)} or smaller.`);
          continue;
        }

        nextImageAttachments.push({
          file,
          previewUrl: URL.createObjectURL(file),
        });
        continue;
      }

      if (isPlainTextFile(file)) {
        if (file.size > providerCapabilities.maxTextFileBytes) {
          setAttachmentError(`Text files must be ${formatBytes(providerCapabilities.maxTextFileBytes)} or smaller.`);
          continue;
        }

        textSnippets.push(await readTextFile(file));
        continue;
      }

      setAttachmentError('Unsupported file type. Attach images or plain text files only.');
    }

    if (nextImageAttachments.length > 0) {
      setSelectedFiles(previous => [...previous, ...nextImageAttachments]);
    }

    if (textSnippets.length > 0) {
      appendTextSnippets(textSnippets);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(previous => {
      const fileToRemove = previous[index];
      if (fileToRemove) {
        revokePreviewUrl(fileToRemove);
      }
      return previous.filter((_, fileIndex) => fileIndex !== index);
    });
  };

  const updateTemplatePicker = (draft: string, cursor: number) => {
    const beforeCursor = draft.slice(0, cursor);
    const slashIndex = beforeCursor.lastIndexOf('/');
    if (slashIndex < 0) {
      closeTemplatePicker();
      return;
    }

    const query = beforeCursor.slice(slashIndex + 1);
    const isCommandBoundary = slashIndex === 0 || /\s/.test(beforeCursor[slashIndex - 1]);
    if (!isCommandBoundary || /\s/.test(query)) {
      closeTemplatePicker();
      return;
    }

    setSlashRange({ start: slashIndex, end: cursor });
    setHighlightedTemplateIndex(0);
  };

  const insertTemplate = (template: PromptTemplate) => {
    const start = slashRange?.start ?? value.length;
    const end = slashRange?.end ?? value.length;
    const nextValue = `${value.slice(0, start)}${template.content}${value.slice(end)}`;
    const nextCursor = start + template.content.length;

    onChange(nextValue);
    closeTemplatePicker();
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const appendTextSnippets = (snippets: string[]) => {
    const prefix = value && !value.endsWith('\n') ? '\n\n' : '';
    onChange(`${value}${prefix}${snippets.join('\n\n')}`);
  };

  const closeTemplatePicker = () => {
    setSlashRange(null);
    setHighlightedTemplateIndex(0);
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedFiles.map(({ file, previewUrl }, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="group relative">
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Remove attachment ${file.name}`}
                    type="button"
                  >
                    x
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
                  <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="max-w-[120px] truncate text-sm text-gray-700">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={`Remove attachment ${file.name}`}
                    type="button"
                  >
                    x
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {attachmentError && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {attachmentError}
        </div>
      )}

      <div className="flex items-end gap-2">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          accept="image/*,.pdf,.doc,.docx,.txt"
          multiple
          title={providerCapabilities.supportsAttachments ? 'Upload file' : 'Images disabled; text files still import'}
        />
        {!providerCapabilities.supportsAttachments && (
          <span className="mb-2 text-xs text-gray-400">Images disabled; .txt import available</span>
        )}

        <div className="relative flex-1">
          {slashRange && (
            <div className="absolute bottom-full left-0 z-20 mb-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((template, index) => (
                  <button
                    key={template.id}
                    onMouseDown={event => {
                      event.preventDefault();
                      insertTemplate(template);
                    }}
                    className={`block w-full px-3 py-2 text-left ${
                      index === activeTemplateIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    type="button"
                  >
                    <div className="truncate text-sm font-medium text-gray-900">{template.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-gray-500">{template.content}</div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">No matching templates</div>
              )}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            onClick={handleSelectionChange}
            onKeyUp={handleKeyUp}
            placeholder="Type a message... (Shift+Enter for newline)"
            aria-label="Chat message draft"
            className="max-h-32 min-h-[44px] w-full resize-none rounded-xl border border-gray-300 px-4 py-2 pr-12 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            disabled={isLoading}
          />
        </div>

        {isLoading ? (
          <button
            onClick={onStop}
            className="rounded-xl bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            title="Stop generation"
            aria-label="Stop generation"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => void handleSend()}
            disabled={!value.trim() && selectedFiles.length === 0}
            className="rounded-xl bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            title="Send message"
            aria-label="Send message"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-400">
        <span>{providerCapabilities.streaming ? 'Streaming on' : 'Streaming off'}</span>
        <span>Image limit {formatBytes(providerCapabilities.maxImageAttachmentBytes)}</span>
        <span>Text limit {formatBytes(providerCapabilities.maxTextFileBytes)}</span>
      </div>
    </div>
  );
}

function revokePreviewUrl(selected: SelectedAttachment) {
  if (selected.previewUrl) {
    URL.revokeObjectURL(selected.previewUrl);
  }
}

function wrapTemplateIndex(index: number, templateCount: number) {
  if (templateCount === 0) return 0;
  return (index + templateCount) % templateCount;
}

function isPlainTextFile(file: File): boolean {
  return file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
}

function readTextFile(file: File): Promise<string> {
  return file.text().then(text => `File: ${file.name}\n\n${text}`);
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}
