'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Field, inputCls, ThemedSelect, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import { InventoryIconLabel } from './InventoryIconLabel';
import type { Item } from './ItemsPanel';
type Lookup = { id: string; name: string; abbreviation?: string };
export function OrderNewItem({ name, unit, categories, units, onAdded, onCancel }: { name: string; unit: string; categories: Lookup[]; units: Lookup[]; onAdded: (item: Item) => void; onCancel: () => void }) {
 const matches = units.filter(u => [u.name, u.abbreviation].some(v => v?.trim().toLowerCase() === unit.trim().toLowerCase()));
 const [draft, setDraft] = useState({ name, code: '', categoryId: '', unitId: matches.length === 1 ? matches[0].id : '', type: 'RETURNABLE', description: '', lowStockLevel: '0' });
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const add = async () => {
  if (saving || !draft.name.trim() || !draft.categoryId || !draft.unitId) return;
  setSaving(true); setError('');
  try { const response = await api.post('/admin/inventory/items', draft); onAdded(response.data.data); }
  catch (err) { setError(getErrorMessage(err, 'Could not add item')); }
  finally { setSaving(false); }
 };
 return <div className="rounded-xl bg-muted/30 p-3 space-y-3"><p className="text-sm font-semibold">Add new inventory item</p><fieldset disabled={saving} className="space-y-3"><Field label="Item name *"><input maxLength={120} className={inputCls} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field><Field label="Item code/Serial no."><input maxLength={40} className={inputCls} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="Auto-generated if left blank" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Category *"><ThemedSelect value={draft.categoryId} onChange={categoryId => setDraft({ ...draft, categoryId })} options={categories.map(c => ({ value: c.id, label: <InventoryIconLabel kind="categories" name={c.name} /> }))} /></Field><Field label="Unit *"><ThemedSelect value={draft.unitId} onChange={unitId => setDraft({ ...draft, unitId })} options={matches.map(u => ({ value: u.id, label: <InventoryIconLabel kind="units" name={u.name} /> }))} /></Field></div><Field label="Type *"><ThemedSelect value={draft.type} onChange={type => setDraft({ ...draft, type })} options={[{ value: 'CONSUMABLE', label: 'Consumables' }, { value: 'RETURNABLE', label: 'Returnable equipment' }, { value: 'FIXED_ASSET', label: 'Fixed assets' }]} /></Field></fieldset>{!matches.length && <p role="alert" className="text-xs text-red-500">Add the requested unit in Setup first: {unit}.</p>}{!categories.length && <p role="alert" className="text-xs text-red-500">Add a category in Setup first.</p>}{error && <p role="alert" className="text-xs text-red-500">{error}</p>}<p className="text-xs text-muted-foreground">Creates the item with zero stock. Stock increases when delivery is received.</p><div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton type="button" disabled={saving || !draft.name.trim() || !draft.categoryId || !draft.unitId} onClick={() => void add()}>{saving ? 'Adding...' : 'Add item'}</PrimaryButton></div></div>;
}
