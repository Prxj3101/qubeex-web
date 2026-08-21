// Reverted — the static viewport override tried here caused regressions on
// real devices (still zoomed in on load, and part of the screen going
// missing on iOS). Back to a plain pass-through until this can be iterated
// on with actual device testing in the loop.
export default function AssignmentPaperLayout({ children }: { children: React.ReactNode }) {
    return children;
}
