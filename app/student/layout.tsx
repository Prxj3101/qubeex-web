'use client';

import { Topbar } from '@/components/shared/Topbar';
import PencilLoader from '@/components/student/PencilLoader';
import { FeedBadgeProvider, useFeedBadge } from '@/context/FeedBadgeContext';
import { useStudentStore } from '@/store/studentStore';
import { LayoutDashboard, Rss, ClipboardList, BookOpen, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Bridges the app's login token into localStorage when a page is opened
// inside the app's in-app WebView (test-taking / result screens) instead of
// a real browser. Runs synchronously during render — deliberately NOT inside
// a useEffect — so it lands before this layout's own fetchProfile() effect
// and before the actual test/result page (a child of this layout) even
// mounts and fires its own data-fetching effects. The previous approach
// relied solely on the WebView's injectedJavaScriptBeforeContentLoaded,
// which isn't consistently honored across RN WebView versions/platforms —
// this is a same-origin, code-level fallback that doesn't depend on native
// JS injection timing at all.
function bridgeWebViewToken() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const wvToken = params.get('wvToken');
    if (!wvToken) return;
    try {
        localStorage.setItem('token', decodeURIComponent(wvToken));
        // Remembers that this tab was opened from the app's WebView (the
        // wvToken param itself gets stripped from the URL right after this),
        // so later renders on the same tab can still tell "this is the app's
        // WebView" apart from a normal browser tab — used to hide the shared
        // student nav Topbar only inside the app's assignment-paper WebView,
        // where the app's own native header (with its own back button)
        // already sits above the page, making a second nav bar redundant.
        sessionStorage.setItem('isAppWebView', '1');
    } catch { /* storage unavailable — nothing more we can do here */ }
    // NOTE: stripping wvToken from the URL is handled separately, in an
    // effect (see stripWvTokenFromUrl) — calling history.replaceState here,
    // synchronously during render, triggers React's "Cannot update a
    // component while rendering a different component" warning because
    // Next's router listens for history changes. The token itself still
    // lands in localStorage synchronously above, which is the part that
    // actually needs to beat the child page's data-fetching effect.
}

// Removes the now-consumed wvToken param from the URL so it doesn't linger
// in history/back-stack. Safe to run slightly after render (unlike the
// localStorage write above) since nothing downstream depends on the URL
// being clean before it fetches data.
function stripWvTokenFromUrl() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('wvToken')) return;
    params.delete('wvToken');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
}

function isInAppWebView() {
    if (typeof window === 'undefined') return false;
    try {
        return sessionStorage.getItem('isAppWebView') === '1';
    } catch {
        return false;
    }
}

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
    bridgeWebViewToken();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const { feedHasNew, clearFeedBadge } = useFeedBadge();
    const { fetchProfile, studentId } = useStudentStore();

    // Whether to hide the nav-icons row for the app WebView's assignment
    // paper view. Read from sessionStorage inside an effect (post-mount)
    // rather than during render — the server has no window/sessionStorage
    // at all, so checking it synchronously in the render body would make
    // the very first client render disagree with the server-rendered HTML
    // (nav row present vs. absent) and trip a hydration-mismatch error.
    // Starting both server and the first client render the same way (nav
    // shown), then flipping this true right after mount, avoids that.
    const [hideNavForAppWebView, setHideNavForAppWebView] = useState(false);
    useEffect(() => {
        if (isInAppWebView()) setHideNavForAppWebView(true);
        stripWvTokenFromUrl();
    }, []);

    // Populate store once so division name etc. are available on all student pages
    useEffect(() => {
        if (!studentId) fetchProfile();
    }, []);

    useEffect(() => {
        setLoading(true);
        const t = setTimeout(() => setLoading(false), 1300);
        return () => clearTimeout(t);
    }, [pathname]);

    // Clear badge when user navigates to the feed page
    useEffect(() => {
        if (pathname === '/student/feed') clearFeedBadge();
    }, [pathname, clearFeedBadge]);

    const navItems = [
        { label: 'Overview', href: '/student/overview', icon: LayoutDashboard },
        { label: 'Feed', href: '/student/feed', icon: Rss, badge: feedHasNew },
        { label: 'Tasks', href: '/student/tasks', icon: ClipboardList },
        { label: 'Class', href: '/student/class', icon: BookOpen },
        {
            label: 'Profile', href: '/student/profile', icon: User,
            activePath: ['/student/detail', '/student/attendance', '/student/reportcard', '/student/flags', '/student/fees'],
        },
    ];

    const isSetPasswordPage = pathname?.startsWith('/student/set-password') ?? false;
    // Locks all other navigation while a student is actively taking a test, so
    // they can't tab away mid-exam. Deliberately excludes the /result/... subpath
    // (viewing a past result) - only the live test-taking route locks nav.
    const isTakingTest = /^\/student\/tasks\/tests\/[^/]+$/.test(pathname ?? '');

    const isLocked = isSetPasswordPage || isTakingTest;
    const lockMessage = isSetPasswordPage
        ? 'Set your password to continue'
        : 'Finish or submit the test to navigate away';

    // Assignment paper view opened inside the app's WebView — the app's own
    // native header (back button) already sits above this page, so the row
    // of nav icons (Overview/Feed/Tasks/Class/Profile) under the brand strip
    // is redundant here. Drop just that row (navItems undefined) in that one
    // case; the brand/logo/theme-toggle/avatar strip itself stays. A normal
    // browser tab on this same route keeps the nav row exactly as before.
    const isAppWebViewPaper = /^\/student\/tasks\/assignments\/[^/]+$/.test(pathname ?? '') && hideNavForAppWebView;

    const effectiveNavItems = isAppWebViewPaper
        ? undefined
        : isLocked
            ? navItems.map(item => ({ ...item, locked: true, lockToastMessage: lockMessage }))
            : navItems;

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={effectiveNavItems} restrictNav={isLocked} lockMessage={lockMessage} />
            <main className={`flex-1 min-h-0 overflow-y-auto px-2 ${isAppWebViewPaper ? 'overscroll-none' : ''}`}>
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <PencilLoader size={72} />
                    </div>
                ) : (
                    children
                )}
            </main>
        </div>
    );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    return (
        <FeedBadgeProvider>
            <StudentLayoutInner>{children}</StudentLayoutInner>
        </FeedBadgeProvider>
    );
}
