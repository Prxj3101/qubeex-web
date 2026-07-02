'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Check, StickyNote, ClipboardList, Pin, Pencil } from 'lucide-react';
import api from '@/lib/api';

interface Note {
    id: string;
    text: string;
    color: string;
    createdAt: string;
}

interface Task {
    id: string;
    text: string;
    done: boolean;
}

const NOTE_COLORS = [
    { bg: '#FEF08A', border: '#FDE047', text: '#713F12' },
    { bg: '#BBF7D0', border: '#86EFAC', text: '#14532D' },
    { bg: '#BFDBFE', border: '#93C5FD', text: '#1E3A5F' },
    { bg: '#FED7AA', border: '#FDBA74', text: '#7C2D12' },
    { bg: '#E9D5FF', border: '#D8B4FE', text: '#4C1D95' },
];

const MOCK_NOTES: Note[] = [
    { id: 'n1', text: 'Check Unit Test papers before Friday', color: '#FEF08A', createdAt: '29 May' },
    { id: 'n2', text: 'PTM this Saturday — prepare student reports', color: '#BBF7D0', createdAt: '28 May' },
];

const MOCK_TASKS: Task[] = [
    { id: 't1', text: 'Mark attendance for 10-A', done: true },
    { id: 't2', text: 'Upload Unit Test results', done: false },
    { id: 't3', text: 'Prepare lesson plan for next week', done: false },
    { id: 't4', text: 'Send PTM notice to students', done: false },
];

export default function TeacherNotepad() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);
    const [showNoteInput, setShowNoteInput] = useState(false);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTask, setNewTask] = useState('');
    const [showTaskInput, setShowTaskInput] = useState(false);

    useEffect(() => {
        api.get('/teacher/notepad')
            .then(res => {
                const { notes: n, tasks: t } = res.data.data as {
                    notes: { id: string; text: string; color: string; createdAt: string }[];
                    tasks: { id: string; text: string; done: boolean }[];
                };
                setNotes(n.map(x => ({
                    id: x.id,
                    text: x.text,
                    color: x.color,
                    createdAt: new Date(x.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                })));
                setTasks(t.map(x => ({ id: x.id, text: x.text, done: x.done })));
            })
            .catch(() => { /* leave notepad empty on failure — non-critical widget */ });
    }, []);

    const addNote = () => {
        const text = newNote.trim();
        if (!text) return;
        setNewNote('');
        setShowNoteInput(false);
        api.post('/teacher/notepad/notes', { text, color: selectedColor.bg })
            .then(res => {
                const created = res.data.data as { id: string; text: string; color: string; createdAt: string };
                setNotes(prev => [{
                    id: created.id,
                    text: created.text,
                    color: created.color,
                    createdAt: new Date(created.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                }, ...prev]);
            })
            .catch(() => {});
    };

    const addTask = () => {
        const text = newTask.trim();
        if (!text) return;
        setNewTask('');
        setShowTaskInput(false);
        api.post('/teacher/notepad/tasks', { text })
            .then(res => {
                const created = res.data.data as { id: string; text: string; done: boolean };
                setTasks(prev => [...prev, { id: created.id, text: created.text, done: created.done }]);
            })
            .catch(() => {});
    };

    const toggleTask = (id: string) => {
        const current = tasks.find(t => t.id === id);
        if (!current) return;
        const done = !current.done;
        setTasks(prev => prev.map(t => t.id === id ? { ...t, done } : t));
        api.patch(`/teacher/notepad/tasks/${id}`, { done }).catch(() => {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, done: current.done } : t));
        });
    };
    const deleteTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
        api.delete(`/teacher/notepad/tasks/${id}`).catch(() => {});
    };
    const deleteNote = (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        api.delete(`/teacher/notepad/notes/${id}`).catch(() => {});
    };

    const pending = tasks.filter(t => !t.done).length;
    const done = tasks.filter(t => t.done).length;

    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTaskText, setEditingTaskText] = useState('');

    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNoteText, setEditingNoteText] = useState('');

    return (
        <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col overflow-hidden" style={{ height: '100%' }}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
                <Pin size={15} className="text-muted-foreground" />
                <p className="text-sm font-medium">To-Do List & Notepad</p>
            </div>

            {/* Tasks + Notes side by side */}
            <div className="flex gap-3 flex-1 min-h-0">
                {/* ── LEFT — Tasks ── */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                            <ClipboardList size={13} className="text-muted-foreground" />
                            <p className="text-xs font-semibold">Tasks</p>
                            {pending > 0 && (
                                <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">{pending}</span>
                            )}
                        </div>
                        <button onClick={() => setShowTaskInput(v => !v)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Plus size={12} />
                        </button>
                    </div>

                    <AnimatePresence>ss
                        {showTaskInput && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mb-2">
                                <div className="flex gap-1.5">
                                    <input autoFocus value={newTask} onChange={e => setNewTask(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addTask()}
                                        placeholder="Add task..."
                                        className="flex-1 h-7 px-2 rounded-lg border border-border/50 bg-muted/30 text-[11px] focus:outline-none focus:border-primary/50 transition-all" />
                                    <button onClick={addTask}
                                        className="h-7 px-2 rounded-lg text-[11px] font-semibold text-white hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        Add
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <p className="text-[11px] text-muted-foreground mb-1.5">{pending} pending · <span className="text-emerald-500">{done} done</span></p>

                    <div className="flex-1 overflow-y-auto space-y-1">
                        {tasks.filter(t => !t.done).map((task, i) => (
                            <motion.div key={task.id}
                                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                className="flex items-center gap-2 py-1.5 group">
                                <button onClick={() => toggleTask(task.id)}
                                    className="w-4 h-4 rounded border-2 border-border/60 shrink-0 hover:border-primary transition-colors" />
                                {editingTaskId === task.id ? (
                                    <div className="flex items-center gap-1 flex-1">
                                        <input autoFocus value={editingTaskText} onChange={e => setEditingTaskText(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Escape') setEditingTaskId(null); }}
                                            className="flex-1 h-6 px-2 rounded border border-primary/50 bg-muted/30 text-[11px] focus:outline-none" />
                                        <button onClick={() => {
                                            const text = editingTaskText;
                                            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, text } : t));
                                            setEditingTaskId(null);
                                            api.patch(`/teacher/notepad/tasks/${task.id}`, { text }).catch(() => {});
                                        }}
                                            className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                            <Check size={9} className="text-white" />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-[12px] flex-1 leading-tight">{task.text}</p>
                                )}
                                {editingTaskId !== task.id && (
                                    <button onClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.text); }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                                        <Pencil size={11} />
                                    </button>
                                )}
                                <button onClick={() => deleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
                                    <X size={11} />
                                </button>
                            </motion.div>
                        ))}

                        {tasks.filter(t => t.done).length > 0 && (
                            <>
                                <div className="flex items-center gap-1 py-1">
                                    <div className="flex-1 h-px bg-border/40" />
                                    <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Done</span>
                                    <div className="flex-1 h-px bg-border/40" />
                                </div>
                                {tasks.filter(t => t.done).map(task => (
                                    <motion.div key={task.id}
                                        className="flex items-center gap-2 py-1.5 group opacity-50">
                                        <button onClick={() => toggleTask(task.id)}
                                            className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shrink-0">
                                            <Check size={9} className="text-white" />
                                        </button>
                                        <p className="text-[12px] flex-1 line-through text-muted-foreground leading-tight">{task.text}</p>
                                        <button onClick={() => deleteTask(task.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
                                            <X size={11} />
                                        </button>
                                    </motion.div>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* Divider */}
                <div className="w-px bg-border/40 shrink-0" />

                {/* ── RIGHT — Notes ── */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                            <StickyNote size={13} className="text-muted-foreground" />
                            <p className="text-xs font-semibold">Notes</p>
                            {notes.length > 0 && (
                                <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">{notes.length}</span>
                            )}
                        </div>
                        <button onClick={() => setShowNoteInput(v => !v)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Plus size={12} />
                        </button>
                    </div>

                    <AnimatePresence>
                        {showNoteInput && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="mb-2">
                                <div className="space-y-1.5">
                                    <div className="flex gap-1.5">
                                        {NOTE_COLORS.map((c, i) => (
                                            <button key={i} onClick={() => setSelectedColor(c)}
                                                className={`w-4 h-4 rounded-full border-2 transition-all ${selectedColor.bg === c.bg ? 'scale-125 border-foreground/40' : 'border-transparent'}`}
                                                style={{ background: c.bg }} />
                                        ))}
                                    </div>
                                    <textarea autoFocus value={newNote} onChange={e => setNewNote(e.target.value)}
                                        placeholder="Write a note..."
                                        rows={2}
                                        className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-muted/30 text-[11px] focus:outline-none focus:border-primary/50 transition-all resize-none" />
                                    <button onClick={addNote}
                                        className="w-full h-7 rounded-lg text-[11px] font-semibold text-white hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        Add Note
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex-1 overflow-y-auto space-y-2">                    {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <StickyNote size={20} className="text-muted-foreground/30 mb-1" />
                            <p className="text-[11px] text-muted-foreground">No notes yet</p>
                        </div>
                    ) : notes.map((note, i) => {
                        const colorCfg = NOTE_COLORS.find(c => c.bg === note.color) ?? NOTE_COLORS[0];
                        return (
                            <motion.div key={note.id}
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                                className="relative p-2.5 rounded-xl border group"
                                style={{ background: note.color, borderColor: colorCfg.border }}>
                                {editingNoteId !== note.id && (
                                    <button onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); }}
                                        className="absolute top-1.5 right-6 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20">
                                        <Pencil size={9} style={{ color: colorCfg.text }} />
                                    </button>
                                )}
                                {editingNoteId !== note.id && (
                                    <button onClick={() => deleteNote(note.id)}
                                        className="absolute top-1.5 right-1.5 ...">
                                        <X size={9} style={{ color: colorCfg.text }} />
                                    </button>
                                )}
                                {editingNoteId === note.id ? (
                                    <div className="space-y-1">
                                        <textarea autoFocus value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Escape') setEditingNoteId(null);
                                            }}
                                            rows={2}
                                            className="w-full px-1 py-0.5 rounded text-[18px] bg-black/10 border-none focus:outline-none resize-none"
                                            style={{ color: colorCfg.text, fontFamily: '"Caveat", cursive' }} />
                                        <div className="flex gap-1 justify-end">
                                            <button onClick={() => setEditingNoteId(null)}
                                                className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20">
                                                <X size={9} style={{ color: colorCfg.text }} />
                                            </button>
                                            <button onClick={() => {
                                                const text = editingNoteText;
                                                setNotes(prev => prev.map(n => n.id === note.id ? { ...n, text } : n));
                                                setEditingNoteId(null);
                                                api.patch(`/teacher/notepad/notes/${note.id}`, { text }).catch(() => {});
                                            }}
                                                className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/30">
                                                <Check size={9} style={{ color: colorCfg.text }} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[18px] leading-relaxed pr-8 font-bold" style={{ color: colorCfg.text, fontFamily: '"Caveat", cursive' }}>{note.text}</p>
                                )}
                                <p className="text-[9px] mt-1 opacity-50" style={{ color: colorCfg.text }}>{note.createdAt}</p>
                            </motion.div>
                        );
                    })}
                    </div>
                </div>
            </div>
        </div>
    );
}