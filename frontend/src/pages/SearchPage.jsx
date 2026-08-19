// src/pages/SearchPage.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import {
    Search, FileText, Filter, X, ArrowRight, Loader2,
    BookOpen, Calendar, Bookmark, BookmarkCheck,
    Grid3X3, List, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

// Search result card component
function SearchResultCard({ paper, onToggleDraft, isToggling, query }) {
    const navigate = useNavigate();

    const openPaper = () => {
        navigate(`/study/paper/${paper.paper_id}`);
    };

    // Highlight matching text
    const highlightText = (text) => {
        if (!query || !text) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) =>
            regex.test(part) ?
                <span key={i} className="bg-yellow-200 dark:bg-yellow-800/50 font-medium px-0.5 rounded">{part}</span> :
                part
        );
    };

    return (
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-lg transition-all hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                            {paper.subject}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            {paper.level}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            {paper.year}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            Paper {paper.paper_number}
                        </Badge>
                    </div>
                    <h3 className="font-semibold text-lg mt-2 line-clamp-2">
                        {highlightText(paper.title)}
                    </h3>
                    {paper.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {highlightText(paper.description)}
                        </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {paper.paper_number === 1 ? "AI Q&A" : "Video Solution"}
                        </span>
                        {paper.downloads > 0 && (
                            <span>📥 {paper.downloads} downloads</span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                        onClick={() => onToggleDraft(paper)}
                        disabled={isToggling}
                        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${paper.saved ? "text-primary bg-accent" : "text-muted-foreground hover:bg-secondary"
                            } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={paper.saved ? "Remove from drafts" : "Save to drafts"}
                    >
                        {paper.saved ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
                    </button>
                    <Button onClick={openPaper} size="sm" className="gap-2">
                        Open <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Skeleton loader for search results
function SearchResultSkeleton() {
    return (
        <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex gap-2">
                        <div className="h-5 w-16 bg-secondary/60 rounded-full" />
                        <div className="h-5 w-16 bg-secondary/60 rounded-full" />
                        <div className="h-5 w-16 bg-secondary/60 rounded-full" />
                    </div>
                    <div className="h-6 w-3/4 bg-secondary/60 rounded mt-3" />
                    <div className="h-4 w-full bg-secondary/60 rounded mt-2" />
                    <div className="h-4 w-2/3 bg-secondary/60 rounded mt-1" />
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="h-9 w-9 rounded-lg bg-secondary/60" />
                    <div className="h-9 w-20 rounded-lg bg-secondary/60" />
                </div>
            </div>
        </div>
    );
}

export default function SearchPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("q") || "";

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        level: "all",
        subject: "all",
        year: "all",
        paper: "all",
    });
    const [filterOptions, setFilterOptions] = useState({ levels: [], subjects: [], years: [] });
    const [viewMode, setViewMode] = useState("grid");
    const [togglingDraft, setTogglingDraft] = useState(null);
    const [searchValue, setSearchValue] = useState(query);

    // Load filter options
    useEffect(() => {
        api.get("/papers/filters")
            .then((r) => {
                setFilterOptions({
                    levels: r.data.levels || [],
                    subjects: r.data.subjects || [],
                    years: r.data.years || [],
                });
            })
            .catch(() => { });
    }, []);

    // Perform search
    const performSearch = useCallback(async () => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const params = {
                q: query.trim(),
                ...(filters.level !== "all" && { level: filters.level }),
                ...(filters.subject !== "all" && { subject: filters.subject }),
                ...(filters.year !== "all" && { year: Number(filters.year) }),
                ...(filters.paper !== "all" && { paper: Number(filters.paper) }),
            };

            const response = await api.get("/papers", { params });
            setResults(response.data || []);
        } catch (error) {
            console.error("Search error:", error);
            toast.error("Failed to perform search. Please try again.");
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [query, filters]);

    // Trigger search when query or filters change
    useEffect(() => {
        performSearch();
    }, [performSearch]);

    // Handle search submission
    const handleSearch = (e) => {
        e.preventDefault();
        const trimmed = searchValue.trim();
        if (trimmed) {
            setSearchParams({ q: trimmed });
        } else {
            setSearchParams({});
            setResults([]);
        }
    };

    // Handle filter change
    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            level: "all",
            subject: "all",
            year: "all",
            paper: "all",
        });
    };

    // Clear search
    const clearSearch = () => {
        setSearchValue("");
        setSearchParams({});
        setResults([]);
        navigate("/search");
    };

    // Toggle draft save
    const toggleDraft = async (paper) => {
        if (togglingDraft === paper.paper_id) return;
        setTogglingDraft(paper.paper_id);

        const wasSaved = paper.saved;
        setResults((prev) =>
            prev.map((p) =>
                p.paper_id === paper.paper_id ? { ...p, saved: !wasSaved } : p
            )
        );

        try {
            const response = await api.post("/drafts", { paper_id: paper.paper_id });
            const { saved } = response.data;
            setResults((prev) =>
                prev.map((p) =>
                    p.paper_id === paper.paper_id ? { ...p, saved } : p
                )
            );
            toast.success(saved ? "Saved to Drafts" : "Removed from Drafts");
        } catch (error) {
            setResults((prev) =>
                prev.map((p) =>
                    p.paper_id === paper.paper_id ? { ...p, saved: wasSaved } : p
                )
            );
            toast.error("Could not update drafts");
        } finally {
            setTogglingDraft(null);
        }
    };

    // Get active filters count
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.level !== "all") count++;
        if (filters.subject !== "all") count++;
        if (filters.year !== "all") count++;
        if (filters.paper !== "all") count++;
        return count;
    }, [filters]);

    return (
        <div className="space-y-6 max-w-[1400px]">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-display font-bold">Search</h1>
                <p className="text-muted-foreground mt-1">
                    Search past papers by title, subject, level, year, or paper number
                </p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder="Search papers by title, subject, level, year, or paper number..."
                            className="pl-12 h-14 text-lg rounded-xl border-2 focus:border-primary"
                            autoFocus
                        />
                        {searchValue && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                    <Button type="submit" size="lg" className="h-14 px-8 gap-2 shrink-0">
                        <Search className="h-5 w-5" /> Search
                    </Button>
                </div>
            </form>

            {/* Active query display */}
            {query && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>Showing results for:</span>
                    <Badge variant="default" className="text-sm py-1.5 px-3">
                        "{query}"
                    </Badge>
                    {results.length > 0 && (
                        <span className="ml-2">({results.length} results)</span>
                    )}
                </div>
            )}

            {/* Filters - Only show if there's a search query */}
            {query && (
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Filters</span>
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                    {activeFilterCount} active
                                </Badge>
                            )}
                        </div>
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-8">
                                <X className="h-3 w-3" /> Clear
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Select
                            value={filters.level}
                            onValueChange={(v) => handleFilterChange("level", v)}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="All Levels" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Levels</SelectItem>
                                {filterOptions.levels.map((l) => (
                                    <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.subject}
                            onValueChange={(v) => handleFilterChange("subject", v)}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="All Subjects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {filterOptions.subjects.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.year}
                            onValueChange={(v) => handleFilterChange("year", v)}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="All Years" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Years</SelectItem>
                                {filterOptions.years.map((y) => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.paper}
                            onValueChange={(v) => handleFilterChange("paper", v)}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="All Papers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Papers</SelectItem>
                                {[1, 2, 3].map((p) => (
                                    <SelectItem key={p} value={String(p)}>Paper {p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* Results */}
            {query && (
                <>
                    {/* Results header with view toggle */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                            {loading ? (
                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                                </span>
                            ) : (
                                <span className="text-sm text-muted-foreground">
                                    {results.length} {results.length === 1 ? "result" : "results"} found
                                </span>
                            )}
                        </div>
                        <div className="flex gap-1 border rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "hover:bg-secondary"
                                    }`}
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-primary text-white" : "hover:bg-secondary"
                                    }`}
                            >
                                <List className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Results grid/list */}
                    {loading ? (
                        <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                            }`}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <SearchResultSkeleton key={i} />
                            ))}
                        </div>
                    ) : results.length > 0 ? (
                        <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                            }`}>
                            {results.map((paper) => (
                                <SearchResultCard
                                    key={paper.paper_id}
                                    paper={paper}
                                    onToggleDraft={toggleDraft}
                                    isToggling={togglingDraft === paper.paper_id}
                                    query={query}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-xl font-semibold">No results found</h3>
                            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                                We couldn't find any papers matching your search. Try adjusting your search terms or filters.
                            </p>
                            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                                <Button variant="outline" onClick={clearSearch}>
                                    Clear search
                                </Button>
                                <Button variant="outline" onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Empty state - no search yet */}
            {!query && (
                <div className="text-center py-20">
                    <Search className="h-20 w-20 text-muted-foreground/30 mx-auto mb-6" />
                    <h2 className="text-2xl font-display font-semibold">Search for Past Papers</h2>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                        Search by title, subject, level, year, or paper number to find the past papers you need.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                        <Badge variant="outline" className="px-4 py-2 text-sm cursor-default">Mathematics</Badge>
                        <Badge variant="outline" className="px-4 py-2 text-sm cursor-default">GCE A Level</Badge>
                        <Badge variant="outline" className="px-4 py-2 text-sm cursor-default">2023</Badge>
                        <Badge variant="outline" className="px-4 py-2 text-sm cursor-default">Paper 1</Badge>
                        <Badge variant="outline" className="px-4 py-2 text-sm cursor-default">Physics</Badge>
                    </div>
                </div>
            )}
        </div>
    );
}