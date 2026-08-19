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




















// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
// import remarkMath from 'remark-math';
// import remarkBreaks from 'remark-breaks';
// import rehypeRaw from 'rehype-raw';
// import rehypeKatex from 'rehype-katex';
// import rehypeSanitize from 'rehype-sanitize';
// import { defaultSchema } from 'hast-util-sanitize';
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// import 'katex/dist/katex.min.css';

// // ============================================================
// // Sanitize schema
// // ============================================================
// // rehype-sanitize's default schema doesn't know about the tags/attributes
// // KaTeX renders (MathML elements, the SVG glyphs it draws for things like
// // \boxed, and the className/style it uses for layout). Without extending
// // the schema, sanitize would strip all of that back out right after
// // rehype-katex renders it, and every equation would come out blank.
// const katexSchema = {
//     ...defaultSchema,
//     tagNames: [
//         ...(defaultSchema.tagNames || []),
//         'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'msubsup',
//         'mfrac', 'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'mtext', 'mspace',
//         'mstyle', 'annotation', 'mover', 'munder', 'munderover', 'mpadded',
//         'merror', 'mphantom', 'menclose', 'mmultiscripts', 'mprescripts', 'none',
//         'svg', 'path', 'g', 'line',
//     ],
//     attributes: {
//         ...defaultSchema.attributes,
//         '*': [...new Set([...(defaultSchema.attributes?.['*'] || []), 'className', 'style'])],
//         span: [...new Set([...(defaultSchema.attributes?.span || []), 'style'])],
//         svg: ['xmlns', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'style', 'focusable', 'role'],
//         path: ['d', 'fill', 'stroke', 'strokeWidth'],
//         line: ['x1', 'y1', 'x2', 'y2', 'strokeWidth'],
//         annotation: ['encoding'],
//         math: ['xmlns', 'display'],
//     },
// };

// export default function Markdown({ children, className = "" }) {
//     return (
//         <div className={`markdown-body ${className}`}>
//             <ReactMarkdown
//                 remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
//                 rehypePlugins={[
//                     rehypeRaw,
//                     [rehypeKatex, { output: 'mathmlAndHtml', strict: false }],
//                     [rehypeSanitize, katexSchema]
//                 ]}
//                 components={{
//                     // Headings with better spacing
//                     h1: ({ node, ...props }) => (
//                         <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border text-foreground" {...props} />
//                     ),
//                     h2: ({ node, ...props }) => (
//                         <h2 className="text-xl font-bold mt-5 mb-3 pb-1.5 border-b border-border/50 text-foreground" {...props} />
//                     ),
//                     h3: ({ node, ...props }) => (
//                         <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground" {...props} />
//                     ),
//                     h4: ({ node, ...props }) => (
//                         <h4 className="text-base font-semibold mt-3 mb-1.5 text-foreground/90" {...props} />
//                     ),
//                     h5: ({ node, ...props }) => (
//                         <h5 className="text-sm font-semibold mt-2 mb-1 text-foreground/80" {...props} />
//                     ),
//                     h6: ({ node, ...props }) => (
//                         <h6 className="text-sm font-medium mt-2 mb-1 text-foreground/70" {...props} />
//                     ),

//                     // Paragraphs with better readability
//                     p: ({ node, ...props }) => (
//                         <p className="mb-3 leading-relaxed text-foreground/90 whitespace-pre-line" {...props} />
//                     ),

//                     // Lists with better spacing
//                     ul: ({ node, ...props }) => (
//                         <ul className="list-disc pl-6 mb-3 space-y-1.5" {...props} />
//                     ),
//                     ol: ({ node, ...props }) => (
//                         <ol className="list-decimal pl-6 mb-3 space-y-1.5" {...props} />
//                     ),
//                     li: ({ node, checked, ...props }) => (
//                         <li className="mb-1 leading-relaxed" {...props} />
//                     ),

//                     // Blockquotes - more prominent
//                     blockquote: ({ node, ...props }) => (
//                         <blockquote
//                             className="border-l-4 border-primary pl-4 py-2 my-3 bg-primary/5 rounded-r text-foreground/80 italic"
//                             {...props}
//                         />
//                     ),

//                     // Code blocks with syntax highlighting
//                     code: ({ node, inline, className, children, ...props }) => {
//                         const match = /language-(\w+)/.exec(className || '');
//                         const language = match ? match[1] : '';

//                         if (!inline && language) {
//                             return (
//                                 <div className="rounded-lg overflow-hidden my-3 border border-border">
//                                     <div className="bg-secondary/80 px-3 py-1.5 text-xs text-muted-foreground border-b border-border font-mono">
//                                         {language}
//                                     </div>
//                                     <SyntaxHighlighter
//                                         style={vscDarkPlus}
//                                         language={language}
//                                         PreTag="div"
//                                         className="!m-0 !bg-[#1e1e1e]"
//                                         customStyle={{
//                                             padding: '1rem',
//                                             fontSize: '0.875rem',
//                                             lineHeight: '1.6',
//                                         }}
//                                     >
//                                         {String(children).replace(/\n$/, '')}
//                                     </SyntaxHighlighter>
//                                 </div>
//                             );
//                         }

//                         if (!inline) {
//                             return (
//                                 <div className="bg-secondary/50 rounded-lg p-3 my-2 overflow-x-auto border border-border">
//                                     <code className="text-sm font-mono text-foreground/90" {...props}>
//                                         {children}
//                                     </code>
//                                 </div>
//                             );
//                         }

//                         return (
//                             <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-sm font-mono text-primary" {...props}>
//                                 {children}
//                             </code>
//                         );
//                     },

//                     // Tables with better styling
//                     table: ({ node, ...props }) => (
//                         <div className="overflow-x-auto my-4 rounded-lg border border-border">
//                             <table className="min-w-full border-collapse" {...props} />
//                         </div>
//                     ),
//                     thead: ({ node, ...props }) => (
//                         <thead className="bg-secondary/50" {...props} />
//                     ),
//                     th: ({ node, ...props }) => (
//                         <th className="border border-border px-4 py-2.5 text-left font-semibold text-sm" {...props} />
//                     ),
//                     td: ({ node, ...props }) => (
//                         <td className="border border-border px-4 py-2.5 text-sm text-foreground/90" {...props} />
//                     ),
//                     tr: ({ node, ...props }) => (
//                         <tr className="hover:bg-secondary/30 transition-colors" {...props} />
//                     ),

//                     // Links with better styling
//                     a: ({ node, href, children, ...props }) => (
//                         <a
//                             href={href}
//                             className="text-primary hover:underline underline-offset-2 font-medium"
//                             target="_blank"
//                             rel="noopener noreferrer"
//                             {...props}
//                         >
//                             {children}
//                         </a>
//                     ),

//                     // Images
//                     img: ({ node, ...props }) => (
//                         <img className="rounded-lg max-w-full h-auto my-4 border border-border" {...props} />
//                     ),

//                     // Horizontal rule
//                     hr: ({ node, ...props }) => (
//                         <hr className="my-6 border-border" {...props} />
//                     ),

//                     // Strong/Bold
//                     strong: ({ node, ...props }) => (
//                         <strong className="font-semibold text-foreground" {...props} />
//                     ),

//                     // Emphasis/Italic
//                     em: ({ node, ...props }) => (
//                         <em className="italic text-foreground/80" {...props} />
//                     ),
//                 }}
//             >
//                 {children}
//             </ReactMarkdown>
//         </div>
//     );
// }





















// components/Markdown.jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema } from 'hast-util-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

// ============================================================
// Sanitize schema for KaTeX
// ============================================================
const katexSchema = {
    ...defaultSchema,
    tagNames: [
        ...(defaultSchema.tagNames || []),
        'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'msubsup',
        'mfrac', 'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'mtext', 'mspace',
        'mstyle', 'annotation', 'mover', 'munder', 'munderover', 'mpadded',
        'merror', 'mphantom', 'menclose', 'mmultiscripts', 'mprescripts', 'none',
        'svg', 'path', 'g', 'line',
    ],
    attributes: {
        ...defaultSchema.attributes,
        '*': [...new Set([...(defaultSchema.attributes?.['*'] || []), 'className', 'style'])],
        span: [...new Set([...(defaultSchema.attributes?.span || []), 'style'])],
        svg: ['xmlns', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'style', 'focusable', 'role'],
        path: ['d', 'fill', 'stroke', 'strokeWidth'],
        line: ['x1', 'y1', 'x2', 'y2', 'strokeWidth'],
        annotation: ['encoding'],
        math: ['xmlns', 'display'],
    },
};

// ============================================================
// CSS for markdown rendering
// ============================================================
const markdownStyles = `
    .markdown-body {
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-width: 100%;
        min-width: 0;
        line-height: 1.7;
        color: var(--foreground);
    }
    
    .markdown-body * {
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    
    /* Headings */
    .markdown-body h1 {
        font-size: 1.8em;
        font-weight: 700;
        margin-top: 1.5em;
        margin-bottom: 0.75em;
        padding-bottom: 0.3em;
        border-bottom: 2px solid var(--border);
        line-height: 1.3;
        word-wrap: break-word;
    }
    
    .markdown-body h2 {
        font-size: 1.5em;
        font-weight: 600;
        margin-top: 1.25em;
        margin-bottom: 0.625em;
        padding-bottom: 0.2em;
        border-bottom: 1px solid var(--border);
        line-height: 1.3;
        word-wrap: break-word;
    }
    
    .markdown-body h3 {
        font-size: 1.25em;
        font-weight: 600;
        margin-top: 1em;
        margin-bottom: 0.5em;
        line-height: 1.3;
        word-wrap: break-word;
    }
    
    .markdown-body h4 {
        font-size: 1.1em;
        font-weight: 600;
        margin-top: 0.875em;
        margin-bottom: 0.5em;
        line-height: 1.3;
        word-wrap: break-word;
    }
    
    .markdown-body h5, .markdown-body h6 {
        font-size: 1em;
        font-weight: 600;
        margin-top: 0.75em;
        margin-bottom: 0.5em;
        line-height: 1.3;
        word-wrap: break-word;
    }
    
    /* Paragraphs */
    .markdown-body p {
        margin-top: 0;
        margin-bottom: 0.75em;
        line-height: 1.7;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    
    /* Lists */
    .markdown-body ul {
        list-style-type: disc;
        padding-left: 1.5em;
        margin-top: 0.5em;
        margin-bottom: 0.75em;
        word-wrap: break-word;
    }
    
    .markdown-body ol {
        list-style-type: decimal;
        padding-left: 1.5em;
        margin-top: 0.5em;
        margin-bottom: 0.75em;
        word-wrap: break-word;
    }
    
    .markdown-body li {
        margin-bottom: 0.25em;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    
    .markdown-body li > p {
        margin-bottom: 0.25em;
    }
    
    /* Blockquotes */
    .markdown-body blockquote {
        border-left: 4px solid var(--primary);
        padding-left: 1em;
        padding-top: 0.5em;
        padding-bottom: 0.5em;
        margin-top: 0.75em;
        margin-bottom: 0.75em;
        background-color: var(--secondary);
        border-radius: 0 0.5rem 0.5rem 0;
        color: var(--foreground);
        font-style: italic;
        word-wrap: break-word;
    }
    
    .markdown-body blockquote p {
        margin-bottom: 0;
    }
    
    /* Code */
    .markdown-body code {
        background-color: var(--secondary);
        padding: 0.125em 0.375em;
        border-radius: 0.25rem;
        font-size: 0.875em;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        word-wrap: break-word;
        overflow-wrap: break-word;
        color: var(--primary);
    }
    
    .markdown-body pre {
        background-color: #1e1e1e;
        padding: 1em;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin-top: 0.75em;
        margin-bottom: 0.75em;
        border: 1px solid var(--border);
        max-width: 100%;
    }
    
    .markdown-body pre code {
        background-color: transparent;
        padding: 0;
        color: #d4d4d4;
        font-size: 0.875em;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    
    /* Tables */
    .markdown-body table {
        display: block;
        overflow-x: auto;
        max-width: 100%;
        border-collapse: collapse;
        margin-top: 0.75em;
        margin-bottom: 0.75em;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        -webkit-overflow-scrolling: touch;
    }
    
    .markdown-body table thead {
        background-color: var(--secondary);
    }
    
    .markdown-body table th {
        padding: 0.625rem 0.875rem;
        text-align: left;
        font-weight: 600;
        border-bottom: 2px solid var(--border);
        white-space: nowrap;
        word-wrap: break-word;
    }
    
    .markdown-body table td {
        padding: 0.625rem 0.875rem;
        border-bottom: 1px solid var(--border);
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-width: 300px;
        white-space: normal;
    }
    
    .markdown-body table tr:last-child td {
        border-bottom: none;
    }
    
    .markdown-body table tr:hover {
        background-color: var(--secondary);
    }
    
    /* Links */
    .markdown-body a {
        color: var(--primary);
        text-decoration: underline;
        text-underline-offset: 2px;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    
    .markdown-body a:hover {
        opacity: 0.8;
    }
    
    /* Images */
    .markdown-body img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin-top: 0.75em;
        margin-bottom: 0.75em;
        border: 1px solid var(--border);
    }
    
    /* Horizontal rules */
    .markdown-body hr {
        border: none;
        border-top: 2px solid var(--border);
        margin-top: 1.5em;
        margin-bottom: 1.5em;
    }
    
    /* KaTeX math */
    .markdown-body .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
        padding: 0.5em 0;
        max-width: 100%;
        -webkit-overflow-scrolling: touch;
    }
    
    .markdown-body .katex-display > .katex {
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
    }
    
    .markdown-body .katex {
        font-size: 1.1em;
        max-width: 100%;
        overflow-x: auto;
    }
    
    .markdown-body .katex .mathnormal {
        font-style: italic;
    }
    
    .markdown-body .math-block {
        overflow-x: auto;
        padding: 0.5em 0;
        -webkit-overflow-scrolling: touch;
    }
    
    .markdown-body .math-inline {
        overflow-x: auto;
    }
    
    /* Strong/Bold */
    .markdown-body strong {
        font-weight: 600;
        color: var(--foreground);
    }
    
    /* Emphasis/Italic */
    .markdown-body em {
        font-style: italic;
        color: var(--foreground);
    }
    
    /* Responsive */
    @media (max-width: 640px) {
        .markdown-body h1 {
            font-size: 1.5em;
        }
        .markdown-body h2 {
            font-size: 1.25em;
        }
        .markdown-body h3 {
            font-size: 1.1em;
        }
        .markdown-body table th,
        .markdown-body table td {
            padding: 0.375rem 0.5rem;
            font-size: 0.85em;
        }
        .markdown-body table td {
            max-width: 150px;
        }
        .markdown-body pre {
            padding: 0.75em;
            font-size: 0.8em;
        }
        .markdown-body .katex {
            font-size: 0.95em;
        }
    }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('markdown-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'markdown-styles';
    styleTag.textContent = markdownStyles;
    document.head.appendChild(styleTag);
}

// ============================================================
// Markdown Component
// ============================================================
export default function Markdown({ children, className = "" }) {
    if (!children) return null;

    return (
        <div className={`markdown-body ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                rehypePlugins={[
                    rehypeRaw,
                    [rehypeKatex, { output: 'mathmlAndHtml', strict: false }],
                    [rehypeSanitize, katexSchema]
                ]}
                components={{
                    // Headings
                    h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border text-foreground" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-bold mt-5 mb-3 pb-1.5 border-b border-border/50 text-foreground" {...props} />
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

                    // Paragraphs
                    p: ({ node, ...props }) => (
                        <p className="mb-3 leading-relaxed text-foreground/90 whitespace-pre-line" {...props} />
                    ),

                    // Lists
                    ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-6 mb-3 space-y-1.5" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-6 mb-3 space-y-1.5" {...props} />
                    ),
                    li: ({ node, checked, ...props }) => (
                        <li className="mb-1 leading-relaxed" {...props} />
                    ),

                    // Blockquotes
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
                                            overflowX: 'auto',
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
                            <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-sm font-mono text-primary break-words" {...props}>
                                {children}
                            </code>
                        );
                    },

                    // Tables
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

                    // Links
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