'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FolderOpen, Folder, FileText, File,
    ChevronRight, Upload, MoreVertical, Trash2,
    FolderPlus, X, Check, Monitor, ArrowLeft,
    FileImage, Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FileItem {
    id: string;
    name: string;
    type: 'pdf' | 'ppt' | 'word' | 'image' | 'other';
    size: string;
    uploadedAt: string;
    fileUrl: string;
    mimeType: string;
}

interface FolderItem {
    id: string;
    name: string;
    children: FolderItem[];
    files: FileItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function mimeToType(mimeType: string): FileItem['type'] {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    if (mimeType.startsWith('image/')) return 'image';
    return 'other';
}

function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function mapFolder(f: any): FolderItem {
    return {
        id: f.id,
        name: f.name,
        children: (f.children ?? []).map(mapFolder),
        files: (f.files ?? []).map((file: any) => ({
            id: file.id,
            name: file.name,
            type: mimeToType(file.mimeType),
            size: formatBytes(file.size),
            uploadedAt: formatDate(file.createdAt),
            fileUrl: file.fileUrl,
            mimeType: file.mimeType,
        })),
    };
}

function getFileIcon(type: FileItem['type']) {
    switch (type) {
        case 'pdf': return { icon: FileText, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950' };
        case 'ppt': return { icon: FileImage, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-950' };
        case 'word': return { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-950' };
        case 'image': return { icon: FileImage, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950' };
        default: return { icon: File, color: 'text-muted-foreground', bg: 'bg-muted' };
    }
}

function findFolder(folders: FolderItem[], path: string[]): FolderItem | null {
    if (path.length === 0) return null;
    let current = folders.find(f => f.id === path[0]);
    if (!current) return null;
    for (let i = 1; i < path.length; i++) {
        current = current!.children.find(f => f.id === path[i]);
        if (!current) return null;
    }
    return current;
}

// ── Folder Tree (Left sidebar) ────────────────────────────────────────────────
function FolderTree({ folders, selectedPath, onSelect, level = 0 }: {
    folders: FolderItem[];
    selectedPath: string[];
    onSelect: (path: string[]) => void;
    level?: number;
}) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    return (
        <div className={level > 0 ? 'pl-4' : ''}>
            {folders.map(folder => {
                const isSelected = selectedPath[selectedPath.length - 1] === folder.id;
                const isExpanded = expanded[folder.id];
                const hasChildren = folder.children.length > 0;

                return (
                    <div key={folder.id}>
                        <button
                            onClick={() => {
                                onSelect([...Array(level).fill(''), folder.id].filter(Boolean));
                                if (hasChildren) setExpanded(p => ({ ...p, [folder.id]: !p[folder.id] }));
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all text-xs ${isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                            {hasChildren && (
                                <ChevronRight size={11} className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            )}
                            {!hasChildren && <div className="w-3 shrink-0" />}
                            {isExpanded
                                ? <FolderOpen size={13} className="shrink-0 text-amber-500" />
                                : <Folder size={13} className="shrink-0 text-amber-500" />
                            }
                            <span className="truncate">{folder.name}</span>
                        </button>
                        {isExpanded && folder.children.length > 0 && (
                            <FolderTree
                                folders={folder.children}
                                selectedPath={selectedPath}
                                onSelect={path => onSelect([folder.id, ...path])}
                                level={level + 1}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StoragePage() {
    const router = useRouter();
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [addingFolder, setAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
    const [uploading, setUploading] = useState(false);

    const fetchFolders = async () => {
        try {
            const res = await api.get('/teacher/blackboard/storage/folders');
            setFolders((res.data.data ?? []).map(mapFolder));
        } catch {
            toast.error('Failed to load storage');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFolders(); }, []);

    const currentFolder = currentPath.length === 0 ? null : findFolder(folders, currentPath);
    const currentFolders = currentPath.length === 0 ? folders : (currentFolder?.children ?? []);
    const currentFiles = currentPath.length === 0 ? [] : (currentFolder?.files ?? []);

    const breadcrumb: { id: string; name: string }[] = [];
    if (currentPath.length > 0) {
        let cur = folders;
        for (const id of currentPath) {
            const f = cur.find(f => f.id === id);
            if (f) { breadcrumb.push({ id: f.id, name: f.name }); cur = f.children; }
        }
    }

    const addFolder = async () => {
        if (!newFolderName.trim()) return;
        const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : undefined;
        try {
            await api.post('/teacher/blackboard/storage/folders', {
                name: newFolderName.trim(),
                ...(parentId ? { parentId } : {}),
            });
            setNewFolderName('');
            setAddingFolder(false);
            toast.success('Folder created');
            await fetchFolders();
        } catch {
            toast.error('Failed to create folder');
        }
    };

    const deleteFolder = async (folderId: string) => {
        try {
            await api.delete(`/teacher/blackboard/storage/folders/${folderId}`);
            toast.success('Folder deleted');
            if (currentPath.includes(folderId)) setCurrentPath([]);
            await fetchFolders();
        } catch {
            toast.error('Failed to delete folder');
        }
    };

    const deleteFile = async (fileId: string) => {
        try {
            await api.delete(`/teacher/blackboard/storage/files/${fileId}`);
            toast.success('File deleted');
            await fetchFolders();
        } catch {
            toast.error('Failed to delete file');
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || currentPath.length === 0) {
            toast.error('Please open a folder first to upload files');
            e.target.value = '';
            return;
        }
        const folderId = currentPath[currentPath.length - 1];
        setUploading(true);
        let successCount = 0;
        for (const file of Array.from(files)) {
            if (file.size > 25 * 1024 * 1024) {
                toast.error(`${file.name} exceeds the 25 MB limit`);
                continue;
            }
            const formData = new FormData();
            formData.append('file', file);
            try {
                await api.post(`/teacher/blackboard/storage/folders/${folderId}/files`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                successCount++;
            } catch {
                toast.error(`Failed to upload ${file.name}`);
            }
        }
        setUploading(false);
        e.target.value = '';
        if (successCount > 0) {
            toast.success(`${successCount} file(s) uploaded`);
            await fetchFolders();
        }
    };

    const openInBlackboard = (file: FileItem) => {
        sessionStorage.setItem('blackboard_file', JSON.stringify({
            url: file.fileUrl,
            name: file.name,
            type: file.mimeType,
        }));
        router.push('/teacher/blackboard');
    };

    const navigateTo = (path: string[]) => {
        setCurrentPath(path);
        setAddingFolder(false);
        setMenuOpen(null);
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-3">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading storage...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-1 pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <FolderOpen size={21} /> Storage
                        </h1>
                        <p className="text-[13px] text-muted-foreground">Manage your teaching materials</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setAddingFolder(true)}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                            <FolderPlus size={13} /> New Folder
                        </button>
                        <label className={`flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white transition-all ${uploading ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}`}
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                            {uploading ? 'Uploading...' : 'Upload'}
                            <input type="file" multiple accept=".pdf,.ppt,.pptx,.doc,.docx" className="hidden"
                                onChange={handleUpload} disabled={uploading} />
                        </label>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Body */}
            <div className="flex gap-3 flex-1 min-h-0 overflow-hidden pb-2">

                {/* LEFT — Folder Tree */}
                <div className="w-[220px] shrink-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-3 py-2.5 border-b border-border/40 shrink-0">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Folders</p>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 py-2">
                        <button
                            onClick={() => navigateTo([])}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all text-xs mb-1 ${currentPath.length === 0 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                            <Folder size={13} className="shrink-0 text-amber-500" />
                            <span>My Storage</span>
                        </button>
                        <div className="h-px bg-border/40 mb-1" />
                        <FolderTree
                            folders={folders}
                            selectedPath={currentPath}
                            onSelect={path => navigateTo(path)}
                        />
                    </div>
                </div>

                {/* RIGHT — Content */}
                <div className="flex-1 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">

                    {/* Breadcrumb + toolbar */}
                    <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                            <button onClick={() => navigateTo([])}
                                className="hover:text-foreground transition-colors font-medium">
                                My Storage
                            </button>
                            {breadcrumb.map((b, i) => (
                                <span key={b.id} className="flex items-center gap-1.5">
                                    <ChevronRight size={11} />
                                    <button
                                        onClick={() => navigateTo(currentPath.slice(0, i + 1))}
                                        className={`hover:text-foreground transition-colors ${i === breadcrumb.length - 1 ? 'text-foreground font-semibold' : ''}`}>
                                        {b.name}
                                    </button>
                                </span>
                            ))}
                        </div>
                        {currentPath.length > 0 && (
                            <button onClick={() => navigateTo(currentPath.slice(0, -1))}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-all">
                                <ArrowLeft size={12} /> Back
                            </button>
                        )}
                    </div>

                    {/* Grid content */}
                    <div className="flex-1 overflow-y-auto px-4 py-3">

                        {/* Add folder input */}
                        {addingFolder && (
                            <div className="flex items-center gap-2 mb-3 p-2 rounded-xl border border-primary/40 bg-primary/5">
                                <Folder size={16} className="text-amber-500 shrink-0" />
                                <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') setAddingFolder(false); }}
                                    placeholder="Folder name..."
                                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60" />
                                <button onClick={addFolder}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    <Check size={12} />
                                </button>
                                <button onClick={() => { setAddingFolder(false); setNewFolderName(''); }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        {/* Empty state */}
                        {currentFolders.length === 0 && currentFiles.length === 0 && !addingFolder && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                    <FolderOpen size={24} className="text-muted-foreground/40" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">Empty folder</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Create a folder or upload files</p>
                            </div>
                        )}

                        {/* Folders grid */}
                        {currentFolders.length > 0 && (
                            <div className="mb-4">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Folders</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {currentFolders.map(folder => (
                                        <motion.div key={folder.id}
                                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                            className="group relative">
                                            <button
                                                onDoubleClick={() => navigateTo([...currentPath, folder.id])}
                                                className="w-full flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border transition-all text-center">
                                                <FolderOpen size={32} className="text-amber-500" />
                                                <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{folder.children.length + folder.files.length} items</p>
                                            </button>
                                            {/* Menu */}
                                            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setMenuOpen(menuOpen === folder.id ? null : folder.id)}
                                                    className="w-6 h-6 rounded-md flex items-center justify-center bg-card border border-border/50 text-muted-foreground hover:text-foreground transition-all">
                                                    <MoreVertical size={11} />
                                                </button>
                                                {menuOpen === folder.id && (
                                                    <div className="absolute right-0 top-7 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[130px]">
                                                        <button onClick={() => { navigateTo([...currentPath, folder.id]); setMenuOpen(null); }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors">
                                                            <FolderOpen size={11} /> Open
                                                        </button>
                                                        <button onClick={() => { setConfirmDelete({ type: 'folder', id: folder.id, name: folder.name }); setMenuOpen(null); }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-muted transition-colors">
                                                            <Trash2 size={11} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Files grid */}
                        {currentFiles.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Files</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {currentFiles.map(file => {
                                        const { icon: Icon, color, bg } = getFileIcon(file.type);
                                        return (
                                            <motion.div key={file.id}
                                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                                className="group relative">
                                                <div className="w-full flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border transition-all text-center">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                                                        <Icon size={20} className={color} />
                                                    </div>
                                                    <p className="text-xs font-medium truncate w-full">{file.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{file.size}</p>
                                                </div>
                                                {/* Menu */}
                                                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setMenuOpen(menuOpen === file.id ? null : file.id)}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center bg-card border border-border/50 text-muted-foreground hover:text-foreground transition-all">
                                                        <MoreVertical size={11} />
                                                    </button>
                                                    {menuOpen === file.id && (
                                                        <div className="absolute right-0 top-7 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                                                            <button onClick={() => { openInBlackboard(file); setMenuOpen(null); }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-primary font-medium">
                                                                <Monitor size={11} /> Open in Blackboard
                                                            </button>
                                                            <button onClick={() => { setConfirmDelete({ type: 'file', id: file.id, name: file.name }); setMenuOpen(null); }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-muted transition-colors">
                                                                <Trash2 size={11} /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm Delete Modal */}
            <AnimatePresence>
                {confirmDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">Delete {confirmDelete.type === 'folder' ? 'Folder' : 'File'}?</h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                <span className="font-semibold text-foreground">{confirmDelete.name}</span> will be permanently deleted.
                                {confirmDelete.type === 'folder' && ' All contents will be lost.'}
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmDelete(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={async () => {
                                    const target = confirmDelete;
                                    setConfirmDelete(null);
                                    if (target.type === 'folder') await deleteFolder(target.id);
                                    else await deleteFile(target.id);
                                }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-red-500 hover:opacity-90 transition-all">
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
