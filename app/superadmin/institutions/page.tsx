'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Building2, School, GraduationCap, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstitutionTable } from '@/components/superadmin/InstitutionTable';
import { CreateInstitutionModal } from '@/components/superadmin/CreateInstitutionModal';
import { Institution } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function InstitutionsPage() {
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'SCHOOL' | 'COLLEGE' | 'CLASS'>('SCHOOL');
    const router = useRouter();
    const filteredInstitutions = institutions.filter((inst) => {
        if (activeTab === 'CLASS') return false;
        return inst.type?.toLowerCase().includes(activeTab.toLowerCase());
    });

    const fetchInstitutions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/institutions');
            setInstitutions(res.data.data);
        } catch {
            toast.error('Failed to fetch institutions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInstitutions();
    }, []);

    return (
        <div className="space-y-6" >
            <div className="flex items-center justify-between px-3 py-3" >
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 size={30} />
                        Institutions
                    </h1>
                    < p className="text-muted-foreground text-sm" > Manage all institutions </p>
                </div>
                < div className="flex gap-2" >
                    <Button variant="outline" size="icon" onClick={fetchInstitutions} >
                        <RefreshCw size={16} />
                    </Button>
                    < Button onClick={() => setModalOpen(true)
                    }>
                        <Plus size={16} className="mr-2" />
                        New Institution
                    </Button>
                </div>
            </div>

            <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">

                {[
                    { label: 'School', value: 'SCHOOL', icon: School },
                    { label: 'College', value: 'COLLEGE', icon: GraduationCap },
                    { label: 'Classes', value: 'CLASS', icon: BookOpen },
                ].map((tab) => {
                    const isActive = activeTab === tab.value;

                    return (
                        <button
                            key={tab.value}
                            onClick={() => setActiveTab(tab.value as any)}
                            className="relative"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="instTab"
                                    className="absolute inset-0 bg-primary rounded-4xl"
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                />
                            )}

                            <div
                                className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl ${isActive
                                    ? 'text-white'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </div>
                        </button>
                    );
                })}
            </div>

            {activeTab === 'CLASS' ? (
                <div className="text-center text-muted-foreground py-20">
                    No classes yet
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                    {filteredInstitutions.map((inst) => (
                        <div key={inst.id} className="bg-card border border-border/50 rounded-xl p-4 space-y-3">

                            {/* TOP INFO */}
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-semibold">
                                    {inst.name?.[0]}
                                </div>

                                <div className="flex-1">
                                    <p className="text-sm font-semibold leading-tight">{inst.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {inst.users?.[0]?.email ?? 'No admin'}
                                    </p>
                                </div>
                            </div>

                            {/* DETAILS */}
                            <div className="text-xs text-muted-foreground space-y-1">
                                <p>📞 {inst.phone ?? 'N/A'}</p>
                                <p>📧 {inst.email}</p>
                                <p>📍 {inst.city ?? 'N/A'}</p>
                            </div>

                            {/* STATUS */}
                            <div className="flex items-center justify-between">
                                <span
                                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${inst.status === 'ACTIVE'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : inst.status === 'PENDING'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}
                                >
                                    {inst.status}
                                </span>

                                <button
                                    onClick={() => router.push(`/superadmin/institutions/${inst.id}`)}
                                    className="text-xs text-primary hover:underline"
                                >
                                    View details →
                                </button>
                            </div>

                        </div>
                    ))}

                </div>
            )}

            {filteredInstitutions.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-20">
                    No {activeTab.toLowerCase()}s found
                </div>
            )}
            <CreateInstitutionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={() => { setModalOpen(false); fetchInstitutions(); }}
            />
        </div>


    );
}