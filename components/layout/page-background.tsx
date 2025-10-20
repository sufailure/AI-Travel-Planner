export function PageBackground() {
    return (
        <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-x-10 top-16 h-80 rounded-full bg-gradient-to-r from-emerald-300/30 via-cyan-300/25 to-purple-300/25 blur-[150px] dark:from-emerald-500/20 dark:via-cyan-500/20 dark:to-purple-500/20" />
            <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-emerald-300/25 blur-[120px] dark:bg-emerald-500/10" />
        </div>
    );
}
