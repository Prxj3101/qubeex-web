'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateInstitutionModal({ open, onClose, onSuccess }: Props) {

    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        type: 'SCHOOL',
        address: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        adminName: '',
        adminEmail: '',
        plan: 'BASIC',
        board: '',
        medium: ''
    });

    const handleChange = (key: string, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleCreate = async () => {
        try {
            setLoading(true);

            await api.post('/superadmin/institutions', form);

            toast.success('Institution created 🚀');
            onSuccess();
            onClose();

        } catch (err) {
            toast.error('Failed to create institution');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">

                <DialogHeader>
                    <DialogTitle>Create New Institution</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3">

                    {/* Institution Info */}
                    <Input placeholder="Institution Name *"
                        value={form.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                    />

                    <Input placeholder="Institution Email *"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                    />

                    <Input placeholder="Phone Number *"
                        value={form.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                    />

                    {/* TYPE DROPDOWN */}
                    <select
                        className="border rounded-md px-3 py-2 text-sm"
                        value={form.type}
                        onChange={(e) => handleChange('type', e.target.value)}
                    >
                        <option value="SCHOOL">School</option>
                        <option value="COLLEGE">College</option>
                        <option value="CLASS">Classes</option>
                    </select>

                    <Input placeholder="Address"
                        value={form.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                    />

                    <Input placeholder="City"
                        value={form.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                    />

                    <Input placeholder="State"
                        value={form.state}
                        onChange={(e) => handleChange('state', e.target.value)}
                    />

                    <Input placeholder="Country"
                        value={form.country}
                        onChange={(e) => handleChange('country', e.target.value)}
                    />

                    <Input placeholder="Pincode"
                        value={form.pincode}
                        onChange={(e) => handleChange('pincode', e.target.value)}
                    />

                    {/* ADMIN */}
                    <Input placeholder="Admin Name *"
                        value={form.adminName}
                        onChange={(e) => handleChange('adminName', e.target.value)}
                    />

                    <Input placeholder="Admin Email *"
                        value={form.adminEmail}
                        onChange={(e) => handleChange('adminEmail', e.target.value)}
                    />

                    {/* PLAN DROPDOWN */}
                    <select
                        className="border rounded-md px-3 py-2 text-sm"
                        value={form.plan}
                        onChange={(e) => handleChange('plan', e.target.value)}
                    >
                        <option value="BASIC">Basic</option>
                        <option value="PRO">Pro</option>
                    </select>

                    <Input placeholder="Board"
                        value={form.board}
                        onChange={(e) => handleChange('board', e.target.value)}
                    />

                    <Input placeholder="Medium"
                        value={form.medium}
                        onChange={(e) => handleChange('medium', e.target.value)}
                    />
                </div>

                {/* BUTTON */}
                <div className="flex justify-end mt-4">
                    <Button onClick={handleCreate} disabled={loading}>
                        {loading ? 'Creating...' : 'Create Institution'}
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    );
}