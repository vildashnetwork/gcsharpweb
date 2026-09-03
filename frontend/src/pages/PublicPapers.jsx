import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Loader2, Lock } from "lucide-react";
import { Seo } from "@/components/Seo";
import api from "@/lib/api";

const SITE_PATH = "/papers";

export function paperSlug(title) {
    return (title || "untitled-paper")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function paperDescription(paper) {
    return paper.description || `${paper.level} ${paper.subject} past paper from ${paper.year}, Paper ${paper.paper_number}.`;
}

function searchText(paper) {
    return [paper.title, paper.subject, paper.level, paper.year, paper.paper_number, paper.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ");
}

function editDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
        const current = [row];
        for (let column = 1; column <= right.length; column += 1) {
            current[column] = left[row - 1] === right[column - 1]
                ? previous[column - 1]
                : 1 + Math.min(previous[column - 1], previous[column], current[column - 1]);
        }
        for (let column = 0; column <= right.length; column += 1) previous[column] = current[column];
    }
    return previous[right.length];
}

function rankPapers(papers, query) {
    const terms = searchText({ title: query }).split(" ").filter(Boolean);
    return papers
        .map((paper) => {
            const words = searchText(paper).split(" ").filter(Boolean);
            const score = terms.reduce((total, term) => {
                const exact = words.some((word) => word.includes(term));
                const close = words.some((word) => editDistance(term, word) <= Math.max(1, Math.floor(term.length / 4)));
                return total + (exact ? 3 : close ? 1 : 0);
            }, 0);
            return { paper, score };
        })
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .map(({ paper }) => paper);
}

function PaperCard({ paper }) {
    return (
        <Link
            to={`${SITE_PATH}/${paper.slug || paperSlug(paper.title)}`}
            className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
        >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-lg font-semibold leading-tight group-hover:text-primary">
                {paper.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
                {paper.subject} · {paper.level} · {paper.year} · Paper {paper.paper_number}
            </p>
            {paper.description && (
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {paper.description}
                </p>
            )}
        </Link>
    );
}

export default function PublicPapers() {
    const { paperSlug: paperSlugParam } = useParams();
    const [papers, setPapers] = useState([]);
    const [paper, setPaper] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        setPaper(null);
        setSearchResults([]);
        const request = paperSlugParam
            ? api.get(`/public/papers/slug/${encodeURIComponent(paperSlugParam)}`)
            : api.get("/public/papers");

        request
            .then(({ data }) => {
                if (cancelled) return;
                if (paperSlugParam) setPaper(data);
                else setPapers(data || []);
            })
            .catch((requestError) => {
                if (!paperSlugParam || requestError.response?.status !== 404) {
                    if (!cancelled) setError("This paper could not be found.");
                    return;
                }

                // Keep title URLs compatible while older backend deployments roll out.
                return api.get("/public/papers")
                    .then(({ data }) => {
                        if (cancelled) return;
                        const match = (data || []).find((item) =>
                            (item.slug || paperSlug(item.title)) === paperSlugParam
                        );
                        if (match) setPaper(match);
                        else setSearchResults(rankPapers(data || [], paperSlugParam.replace(/-/g, " ")));
                    })
                    .catch(() => {
                        if (!cancelled) setError("This paper could not be found.");
                    });
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [paperSlugParam]);

    if (paperSlugParam) {
        const title = paper ? paper.title : "Past Paper";
        const description = paper ? paperDescription(paper) : "Find GCE, HND and Concours past papers on GCSHARP.";
        return (
            <main className="min-h-screen bg-background text-foreground">
                <Seo title={title} description={description} path={`${SITE_PATH}/${paper?.slug || paperSlugParam}`} />
                <div className="mx-auto max-w-4xl px-6 py-10 sm:py-16">
                    <Link to={SITE_PATH} className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" /> All past papers
                    </Link>
                    {loading ? (
                        <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    ) : error ? (
                        <p className="text-muted-foreground">{error}</p>
                    ) : !paper ? (
                        <>
                            <h1 className="font-display text-3xl font-bold sm:text-5xl">Search results for “{paperSlugParam.replace(/-/g, " ")}”</h1>
                            {searchResults.length === 0 ? (
                                <p className="mt-6 text-muted-foreground">No similar papers were found.</p>
                            ) : (
                                <div className="mt-10 grid gap-5 sm:grid-cols-2">
                                    {searchResults.map((item) => <PaperCard key={item.paper_id} paper={item} />)}
                                </div>
                            )}
                        </>
                    ) : (
                        <article>
                            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">GCSHARP past paper</p>
                            <h1 className="max-w-3xl font-display text-3xl font-bold leading-tight sm:text-5xl">{paper.title}</h1>
                            <p className="mt-4 text-muted-foreground">
                                {paper.subject} · {paper.level} · {paper.year} · Paper {paper.paper_number}
                            </p>
                            <p className="mt-8 max-w-2xl text-base leading-8 text-muted-foreground">{description}</p>
                            <div className="mt-10 rounded-xl border border-border bg-secondary/30 p-6">
                                <div className="flex items-start gap-3">
                                    <Lock className="mt-1 h-5 w-5 shrink-0 text-primary" />
                                    <div>
                                        <h2 className="font-semibold">Sign in to open this paper</h2>
                                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                            Sign in to view the PDF, save it, ask GC AI questions, and generate worked solutions.
                                        </p>
                                        <Link to={`/phone-signin?next=/study/paper/${paper.paper_id}`} className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                                            Sign in to continue
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </article>
                    )}
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background text-foreground">
            <Seo
                title="GCE, HND & Concours Past Papers"
                description="Search GCSHARP's database of GCE, HND and Concours past papers by title, subject, level and year."
                path={SITE_PATH}
            />
            <div className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Exam preparation library</p>
                <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">Past papers by title</h1>
                <p className="mt-4 max-w-2xl text-muted-foreground">Browse GCE, HND and Concours papers from the GCSHARP database. Open a paper to see its details, then sign in for the PDF and learning tools.</p>
                {loading ? (
                    <div className="mt-12 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
                ) : error ? (
                    <p className="mt-12 text-muted-foreground">{error}</p>
                ) : papers.length === 0 ? (
                    <p className="mt-12 text-muted-foreground">No papers are available yet.</p>
                ) : (
                    <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {papers.map((item) => <PaperCard key={item.paper_id} paper={item} />)}
                    </div>
                )}
            </div>
        </main>
    );
}
