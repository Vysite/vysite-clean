import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Paperclip, Eye, Download, Trash2, X } from 'lucide-react';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

interface FileUploadProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  accept?: string;
  label?: string;
  maxFiles?: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({ files, onChange, accept = '*', label = 'Upload Files', maxFiles = 10 }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<UploadedFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = (fileList: FileList) => {
    const remaining = maxFiles - files.length;
    const toAdd = Array.from(fileList).slice(0, remaining);

    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const uploaded: UploadedFile = {
          id: `f${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: e.target?.result as string,
        };
        onChange([...files, uploaded]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [files]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const removeFile = (id: string) => onChange(files.filter(f => f.id !== id));

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-[#f97316] bg-orange-950/30'
            : 'border-[#1e2d4a] hover:border-slate-600 bg-[#0d1628]/50 hover:bg-[#0d1628]'
        }`}
      >
        <Upload size={20} className={`mx-auto mb-2 ${dragging ? 'text-[#f97316]' : 'text-slate-600'}`} />
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-[10px] text-slate-600 mt-0.5">Drag & drop or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (() => {
        const images = files.filter(f => f.type.startsWith('image/'));
        const docs   = files.filter(f => !f.type.startsWith('image/'));
        return (
          <div className="space-y-3">
            {/* Image thumbnails */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {images.map(file => (
                  <div key={file.id} className="relative group aspect-square rounded-lg overflow-hidden border border-[#1e2d4a] bg-[#0d1628]">
                    {file.dataUrl && (
                      <img
                        src={file.dataUrl}
                        alt={file.name}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setPreview(file)}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors pointer-events-none" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeFile(file.id); }}
                      className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(file); }}
                      className="absolute bottom-1 right-1 p-1 rounded bg-black/70 text-white hover:bg-[#f97316] transition-colors opacity-0 group-hover:opacity-100"
                      title="Preview"
                    >
                      <Eye size={11} />
                    </button>
                    <p className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] text-white bg-black/60 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Document list */}
            {docs.length > 0 && (
              <div className="space-y-1.5">
                {docs.map(file => {
                  const isPDF = file.type === 'application/pdf';
                  return (
                    <div key={file.id} className="flex items-center gap-2.5 bg-[#0d1628] rounded-lg px-3 py-2 border border-[#1e2d4a] group">
                      <div className="w-7 h-7 rounded bg-[#111827] border border-[#1e2d4a] flex items-center justify-center shrink-0">
                        {isPDF
                          ? <FileText size={13} className="text-red-400" />
                          : <Paperclip size={13} className="text-slate-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-600">{formatSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); removeFile(file.id); }}
                        className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {files.length === 0 && (
        <p className="text-[10px] text-slate-700 flex items-center gap-1">
          <Paperclip size={10} />
          No attachments yet
        </p>
      )}

      {/* Full-screen file viewer */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex flex-col"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-white truncate max-w-xs">{preview.name}</p>
            <div className="flex items-center gap-2">
              {preview.dataUrl && (
                <a
                  href={preview.dataUrl}
                  download={preview.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors"
                >
                  <Download size={13} />Download
                </a>
              )}
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {preview.type.startsWith('image/') && preview.dataUrl ? (
              <img src={preview.dataUrl} alt={preview.name} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : preview.type === 'application/pdf' && preview.dataUrl ? (
              <iframe src={preview.dataUrl} title={preview.name} className="w-full h-full rounded-lg border-0" />
            ) : (
              <div className="text-center">
                <Paperclip size={40} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-4">{preview.name}</p>
                {preview.dataUrl && (
                  <a
                    href={preview.dataUrl}
                    download={preview.name}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
                  >
                    <Download size={14} />Download File
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
