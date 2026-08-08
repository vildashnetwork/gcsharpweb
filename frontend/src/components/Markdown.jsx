import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Normalize common LaTeX delimiters the model emits (\[ \], \( \)) into $$ / $ for remark-math
function normalize(text) {
    if (!text) return "";
    return text
        .replace(/\\\[/g, "$$$$")
        .replace(/\\\]/g, "$$$$")
        .replace(/\\\(/g, "$$")
        .replace(/\\\)/g, "$$");
}

export default function Markdown({ children, className = "" }) {
    return (
        <div className={`md-body ${className}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {normalize(children)}
            </ReactMarkdown>
        </div>
    );
}
