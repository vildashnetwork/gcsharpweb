// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import remarkMath from "remark-math";
// import rehypeKatex from "rehype-katex";
// import "katex/dist/katex.min.css";

// // Normalize common LaTeX delimiters the model emits (\[ \], \( \)) into $$ / $ for remark-math
// function normalize(text) {
//     if (!text) return "";
//     return text
//         .replace(/\\\[/g, "$$$$")
//         .replace(/\\\]/g, "$$$$")
//         .replace(/\\\(/g, "$$")
//         .replace(/\\\)/g, "$$");
// }

// export default function Markdown({ children, className = "" }) {
//     return (
//         <div className={`md-body ${className}`}>
//             <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
//                 {normalize(children)}
//             </ReactMarkdown>
//         </div>
//     );
// }

























// components/Markdown.jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function Markdown({ children, className = "" }) {
    return (
        <div className={`markdown-body ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    // Headings with better spacing
                    h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-bold mt-5 mb-3 pb-1.5 border-b border-border/50" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                        <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground" {...props} />
                    ),
                    h4: ({ node, ...props }) => (
                        <h4 className="text-base font-semibold mt-3 mb-1.5 text-foreground/90" {...props} />
                    ),
                    h5: ({ node, ...props }) => (
                        <h5 className="text-sm font-semibold mt-2 mb-1 text-foreground/80" {...props} />
                    ),
                    h6: ({ node, ...props }) => (
                        <h6 className="text-sm font-medium mt-2 mb-1 text-foreground/70" {...props} />
                    ),

                    // Paragraphs with better readability
                    p: ({ node, ...props }) => (
                        <p className="mb-3 leading-relaxed text-foreground/90" {...props} />
                    ),

                    // Lists with better spacing
                    ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-6 mb-3 space-y-1.5" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-6 mb-3 space-y-1.5" {...props} />
                    ),
                    li: ({ node, checked, ...props }) => (
                        <li className="mb-1 leading-relaxed" {...props} />
                    ),

                    // Blockquotes - more prominent
                    blockquote: ({ node, ...props }) => (
                        <blockquote
                            className="border-l-4 border-primary pl-4 py-2 my-3 bg-primary/5 rounded-r text-foreground/80 italic"
                            {...props}
                        />
                    ),

                    // Code blocks with syntax highlighting
                    code: ({ node, inline, className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const language = match ? match[1] : '';

                        if (!inline && language) {
                            return (
                                <div className="rounded-lg overflow-hidden my-3 border border-border">
                                    <div className="bg-secondary/80 px-3 py-1.5 text-xs text-muted-foreground border-b border-border font-mono">
                                        {language}
                                    </div>
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={language}
                                        PreTag="div"
                                        className="!m-0 !bg-[#1e1e1e]"
                                        customStyle={{
                                            padding: '1rem',
                                            fontSize: '0.875rem',
                                            lineHeight: '1.6',
                                        }}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        }

                        if (!inline) {
                            return (
                                <div className="bg-secondary/50 rounded-lg p-3 my-2 overflow-x-auto border border-border">
                                    <code className="text-sm font-mono text-foreground/90" {...props}>
                                        {children}
                                    </code>
                                </div>
                            );
                        }

                        return (
                            <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-sm font-mono text-primary" {...props}>
                                {children}
                            </code>
                        );
                    },

                    // Tables with better styling
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 rounded-lg border border-border">
                            <table className="min-w-full border-collapse" {...props} />
                        </div>
                    ),
                    thead: ({ node, ...props }) => (
                        <thead className="bg-secondary/50" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                        <th className="border border-border px-4 py-2.5 text-left font-semibold text-sm" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                        <td className="border border-border px-4 py-2.5 text-sm text-foreground/90" {...props} />
                    ),
                    tr: ({ node, ...props }) => (
                        <tr className="hover:bg-secondary/30 transition-colors" {...props} />
                    ),

                    // Links with better styling
                    a: ({ node, href, children, ...props }) => (
                        <a
                            href={href}
                            className="text-primary hover:underline underline-offset-2 font-medium"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                        >
                            {children}
                        </a>
                    ),

                    // Images
                    img: ({ node, ...props }) => (
                        <img className="rounded-lg max-w-full h-auto my-4 border border-border" {...props} />
                    ),

                    // Horizontal rule
                    hr: ({ node, ...props }) => (
                        <hr className="my-6 border-border" {...props} />
                    ),

                    // Strong/Bold
                    strong: ({ node, ...props }) => (
                        <strong className="font-semibold text-foreground" {...props} />
                    ),

                    // Emphasis/Italic
                    em: ({ node, ...props }) => (
                        <em className="italic text-foreground/80" {...props} />
                    ),
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}