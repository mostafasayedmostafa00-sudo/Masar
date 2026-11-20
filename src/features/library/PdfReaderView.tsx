import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, Highlighter, Maximize, Trash2, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { deletePdfBlob, loadPdfBlob, savePdfBlob } from '../../services/storage';
import { PdfDocumentMeta, PdfHighlight } from '../../types/masar';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const HIGHLIGHT_COLORS: Array<{ id: PdfHighlight['color']; bg: string; label: string }> = [
  { id: 'cyan', bg: 'bg-cyan-400/35 border-cyan-400', label: 'Cyan' },
  { id: 'amber', bg: 'bg-amber-400/35 border-amber-400', label: 'Amber' },
  { id: 'emerald', bg: 'bg-emerald-400/35 border-emerald-400', label: 'Emerald' },
  { id: 'violet', bg: 'bg-violet-400/35 border-violet-400', label: 'Violet' },
];

export const PdfReaderView: React.FC = () => {
  const { state, updateState, logBookPages, pushToast } = useMasar();
  const isAr = state.language === 'ar';

  const [activePdfId, setActivePdfId] = useState<string | null>(state.pdfs[0]?.id || null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [scale, setScale] = useState(1.1);
  const [pageText, setPageText] = useState('');
  const [selectedColor, setSelectedColor] = useState<PdfHighlight['color']>('cyan');
  const [highlightNote, setHighlightNote] = useState('');
  const [selectedSnippet, setSelectedSnippet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pinchStartDist = useRef<number | null>(null);

  const activeMeta: PdfDocumentMeta | undefined = state.pdfs.find((p) => p.id === activePdfId);

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const loaded = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const id = `pdf-${Date.now()}`;
      await savePdfBlob(id, buf);
      const newMeta: PdfDocumentMeta = {
        id,
        name: file.name,
        sizeBytes: file.size,
        totalPages: loaded.numPages,
        lastPage: 1,
        highlights: [],
        addedAt: new Date().toISOString(),
      };
      updateState((p) => ({ ...p, pdfs: [newMeta, ...p.pdfs] }));
      setActivePdfId(id);
      setPdfDoc(loaded);
      setPageNum(1);
      setPageInput('1');
      pushToast(isAr ? 'تم حفظ PDF محلياً في IndexedDB.' : 'PDF stored locally in IndexedDB.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF file.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!activePdfId) {
      setPdfDoc(null);
      return;
    }
    setLoading(true);
    setError(null);
    loadPdfBlob(activePdfId)
      .then(async (buf) => {
        if (cancelled) return;
        if (!buf) {
          setError(isAr ? 'ملف PDF غير موجود في التخزين المحلي.' : 'PDF binary not found in local IndexedDB.');
          setLoading(false);
          return;
        }
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        const startPage = Math.min(doc.numPages, Math.max(1, activeMeta?.lastPage || 1));
        setPageNum(startPage);
        setPageInput(String(startPage));
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error opening PDF');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePdfId]);

  // Render active page + extract selectable text
  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    if (!pdfDoc || !canvasRef.current) return;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        renderTask = page.render({ canvas, canvasContext: ctx, viewport });
        await renderTask.promise;

        const textContent = await page.getTextContent();
        const combined = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        setPageText(combined);

        // Save last-read page and sync linked book if present
        if (activeMeta) {
          updateState((p) => ({
            ...p,
            pdfs: p.pdfs.map((m) => (m.id === activeMeta.id ? { ...m, lastPage: pageNum } : m)),
          }));
          if (activeMeta.linkedBookId) {
            logBookPages(activeMeta.linkedBookId, pageNum);
          }
        }
      } catch {
        // Ignore cancelled render
      }
    };

    render();
    return () => {
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum, scale]);

  const handleFitWidth = async () => {
    if (!pdfDoc || !containerRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const unscaled = page.getViewport({ scale: 1 });
    const containerW = Math.max(280, containerRef.current.clientWidth - 24);
    setScale(Number((containerW / unscaled.width).toFixed(2)));
  };

  const handleSaveHighlight = () => {
    if (!activeMeta) return;
    const selectionText = window.getSelection()?.toString().trim();
    const textToSave = selectedSnippet.trim() || selectionText || pageText.slice(0, 140);
    if (!textToSave) return;

    const newHl: PdfHighlight = {
      id: `hl-${Date.now()}`,
      page: pageNum,
      text: textToSave,
      color: selectedColor,
      note: highlightNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    updateState((p) => ({
      ...p,
      pdfs: p.pdfs.map((m) =>
        m.id === activeMeta.id ? { ...m, highlights: [newHl, ...m.highlights] } : m
      ),
    }));
    setSelectedSnippet('');
    setHighlightNote('');
    pushToast(isAr ? 'تم حفظ التظليل والملاحظة.' : 'Highlight saved.', 'success');
  };

  const handleRemoveHighlight = (hlId: string) => {
    if (!activeMeta) return;
    updateState((p) => ({
      ...p,
      pdfs: p.pdfs.map((m) =>
        m.id === activeMeta.id
          ? { ...m, highlights: m.highlights.filter((h) => h.id !== hlId) }
          : m
      ),
    }));
  };

  return (
    <div className="space-y-4">
      {/* Upload & PDF List */}
      <div className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{isAr ? 'قارئ PDF المحلي' : 'Offline PDF Reader'}</h2>
            <p className="text-xs text-slate-500">
              {isAr ? 'تُحفظ الملفات والتظليلات محلياً في IndexedDB.' : 'Uploaded PDFs & highlights persist locally in IndexedDB.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-500"
          >
            <Upload className="w-4 h-4" />
            {isAr ? 'رفع ملف PDF' : 'Upload PDF'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUploadPdf} />
        </div>

        {state.pdfs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 p-6 text-center text-xs text-slate-500">
            {isAr ? 'لا توجد ملفات PDF مرفوعة بعد. ارفع ملفاً للبدء.' : 'No PDFs uploaded yet. Upload a PDF from your device to read & highlight offline.'}
          </div>
        ) : (
          <div className="space-y-2">
            {state.pdfs.map((pdf) => (
              <div
                key={pdf.id}
                className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs ${
                  pdf.id === activePdfId
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActivePdfId(pdf.id)}
                  className="text-start min-w-0 flex-1"
                >
                  <div className="font-semibold truncate">{pdf.name}</div>
                  <div className="text-slate-500 font-mono tabular-nums">
                    {isAr ? `متابعة من صفحة ${pdf.lastPage}` : `Continue from page ${pdf.lastPage}`} / {pdf.totalPages} · {pdf.highlights.length} highlights
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Link PDF to book"
                    value={pdf.linkedBookId || ''}
                    onChange={(e) => {
                      const bookId = e.target.value || undefined;
                      updateState((p) => ({
                        ...p,
                        pdfs: p.pdfs.map((x) => (x.id === pdf.id ? { ...x, linkedBookId: bookId } : x)),
                      }));
                    }}
                    className="min-h-[36px] max-w-[130px] px-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px]"
                  >
                    <option value="">{isAr ? 'ربط بكتاب...' : 'Link book...'}</option>
                    {state.books.map((b) => (
                      <option key={b.id} value={b.id}>{b.title.slice(0, 24)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={`Delete ${pdf.name}`}
                    onClick={async () => {
                      await deletePdfBlob(pdf.id);
                      updateState((p) => ({ ...p, pdfs: p.pdfs.filter((x) => x.id !== pdf.id) }));
                      if (activePdfId === pdf.id) setActivePdfId(null);
                    }}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viewer Controls + Canvas */}
      {activeMeta && (
        <div className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pageNum <= 1}
                onClick={() => {
                  const next = Math.max(1, pageNum - 1);
                  setPageNum(next);
                  setPageInput(String(next));
                }}
                aria-label="Previous page"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-35"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Math.max(1, Math.min(activeMeta.totalPages, Number(pageInput) || 1));
                  setPageNum(n);
                  setPageInput(String(n));
                }}
                className="flex items-center gap-1 text-xs font-mono"
              >
                <input
                  type="number"
                  min={1}
                  max={activeMeta.totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  className="w-14 min-h-[38px] px-2 text-center rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                />
                <span>/ {activeMeta.totalPages}</span>
              </form>
              <button
                type="button"
                disabled={pageNum >= activeMeta.totalPages}
                onClick={() => {
                  const next = Math.min(activeMeta.totalPages, pageNum + 1);
                  setPageNum(next);
                  setPageInput(String(next));
                }}
                aria-label="Next page"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-35"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.15).toFixed(2))))}
                aria-label="Zoom out"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono tabular-nums w-11 text-center">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3, Number((s + 0.15).toFixed(2))))}
                aria-label="Zoom in"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFitWidth}
                aria-label="Fit to width"
                className="min-h-[40px] px-2.5 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs"
              >
                <Maximize className="w-3.5 h-3.5" />
                Fit
              </button>
            </div>
          </div>

          {error && <div className="text-xs text-rose-500 p-2">{error}</div>}
          {loading && <div className="text-xs text-slate-500 p-4 text-center">Loading PDF page...</div>}

          <div
            ref={containerRef}
            className="overflow-auto max-h-[55dvh] rounded-xl bg-slate-100 dark:bg-[#07090F] p-2 flex justify-center"
            onTouchMove={(e) => {
              if (e.touches.length === 2) {
                const dist = Math.hypot(
                  e.touches[0].clientX - e.touches[1].clientX,
                  e.touches[0].clientY - e.touches[1].clientY
                );
                if (pinchStartDist.current) {
                  const ratio = dist / pinchStartDist.current;
                  if (Math.abs(ratio - 1) > 0.08) {
                    setScale((s) => Math.min(3, Math.max(0.5, Number((s * ratio).toFixed(2)))));
                    pinchStartDist.current = dist;
                  }
                } else {
                  pinchStartDist.current = dist;
                }
              }
            }}
            onTouchEnd={() => {
              pinchStartDist.current = null;
            }}
          >
            <canvas ref={canvasRef} className="max-w-full shadow-md rounded" />
          </div>

          {/* Extracted Text Selection + Highlights */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10 text-xs">
            <div className="font-semibold">{isAr ? 'تحديد نص وتظليله' : 'Select Text & Highlight'}</div>
            {pageText && (
              <div
                onMouseUp={() => {
                  const sel = window.getSelection()?.toString().trim();
                  if (sel) setSelectedSnippet(sel);
                }}
                className="max-h-28 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 select-text leading-relaxed"
              >
                {pageText}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(c.id)}
                  className={`min-h-[36px] px-3 rounded-lg border text-xs font-medium ${c.bg} ${
                    selectedColor === c.id ? 'ring-2 ring-white' : 'opacity-70'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={selectedSnippet}
                onChange={(e) => setSelectedSnippet(e.target.value)}
                placeholder={isAr ? 'النص المحدد أو المقتبس...' : 'Selected text snippet...'}
                className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
              />
              <input
                type="text"
                value={highlightNote}
                onChange={(e) => setHighlightNote(e.target.value)}
                placeholder={isAr ? 'ملاحظة على التظليل (اختياري)...' : 'Annotation note (optional)...'}
                className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
              />
              <button
                type="button"
                onClick={handleSaveHighlight}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 rounded-xl bg-cyan-600 text-white font-medium"
              >
                <Highlighter className="w-4 h-4" />
                {isAr ? 'حفظ التظليل' : 'Save Highlight'}
              </button>
            </div>

            {activeMeta.highlights.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="font-semibold">
                  {isAr ? 'قائمة التظليلات' : 'Highlights List'} ({activeMeta.highlights.length})
                </div>
                {activeMeta.highlights.map((hl) => (
                  <div
                    key={hl.id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPageNum(hl.page);
                        setPageInput(String(hl.page));
                      }}
                      className="text-start flex-1 min-w-0"
                    >
                      <span className="font-mono text-cyan-500">p.{hl.page}</span> · <span>{hl.text}</span>
                      {hl.note && <div className="text-slate-500 mt-0.5">{hl.note}</div>}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveHighlight(hl.id)}
                      aria-label="Remove highlight"
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
