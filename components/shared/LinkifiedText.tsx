'use client';

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

interface LinkifiedTextProps {
    text: string;
    className?: string;
}

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
    // URL_REGEX has exactly one capturing group, so String.split keeps the
    // matched URL substrings in the result, interleaved at odd indices:
    // ["plain text before ", "https://matched-url", " plain text after"].
    // Odd index = URL match, even index = plain text. This avoids relying
    // on a global regex's stateful `lastIndex` (a classic source of bugs
    // when the same regex object is reused across calls/renders).
    const parts = text.split(URL_REGEX);

    return (
        <>
            {parts.map((part, i) => {
                const isUrl = i % 2 === 1;
                if (!isUrl) return part;

                const href = part.startsWith('www.') ? `https://${part}` : part;
                return (
                    <a
                        key={i}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={className ?? 'text-primary underline hover:opacity-80 break-all'}
                        onClick={e => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            })}
        </>
    );
}
