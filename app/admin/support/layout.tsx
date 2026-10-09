export default function AdminSupportLayout({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col h-full overflow-hidden"><div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2">{children}</div></div>;
}