"""
Pure-Python natural language processing toolkit used by GC AI.

No external ML dependencies are required (the project ships a light
requirements.txt so it can run on small free-tier containers). Everything
here is deterministic, fast and dependency free:

  * text normalisation / tokenisation / stemming
  * TF-IDF vector space index with cosine similarity
  * feature hashed dense-ish vectors (word + character n-grams) so that
    paraphrases and typos still match
  * extractive summarisation (TF-IDF + position + query overlap)
  * keyword extraction
  * a Multinomial Naive Bayes intent classifier (the "machine learning"
    part of the pipeline - trained at boot, extendable at runtime and
    persistable to MongoDB)
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter, defaultdict
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

# ============================================================
# Vocabulary helpers
# ============================================================

STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "also", "am",
    "an", "and", "any", "are", "aren", "as", "at", "be", "because", "been",
    "before", "being", "below", "between", "both", "but", "by", "can", "cant",
    "cannot", "could", "couldn", "did", "didn", "do", "does", "doesn", "doing",
    "don", "down", "during", "each", "few", "for", "from", "further", "get",
    "give", "had", "has", "have", "having", "he", "her", "here", "hers",
    "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is",
    "isn", "it", "its", "itself", "just", "let", "like", "me", "more", "most",
    "must", "my", "myself", "need", "no", "nor", "not", "now", "of", "off",
    "on", "once", "one", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "please", "same", "she", "should",
    "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
    "themselves", "then", "there", "these", "they", "this", "those", "through",
    "to", "too", "under", "until", "up", "very", "was", "wasn", "we", "were",
    "what", "when", "where", "which", "while", "who", "whom", "why", "will",
    "with", "won", "would", "you", "your", "yours", "yourself", "yourselves",
    # common French function words (Cameroon is bilingual)
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "est", "sont",
    "pour", "avec", "dans", "sur", "que", "qui", "quoi", "comment", "pourquoi",
}

# Domain abbreviations students actually type.
ABBREVIATIONS = {
    "gce": "general certificate of education",
    "al": "advanced level",
    "a/l": "advanced level",
    "ol": "ordinary level",
    "o/l": "ordinary level",
    "hnd": "higher national diploma",
    "bacc": "baccalaureat",
    "prob": "problem",
    "qs": "question",
    "qns": "question",
    "eqn": "equation",
    "eqns": "equation",
    "calc": "calculate",
    "diff": "differentiate",
    "integ": "integrate",
    "phys": "physics",
    "chem": "chemistry",
    "bio": "biology",
    "maths": "mathematics",
    "math": "mathematics",
    "ict": "computer science",
    "cs": "computer science",
    "econ": "economics",
    "wt": "what is",
    "wat": "what is",
    "hw": "how",
    "dont": "do not",
    "doesnt": "does not",
    "cant": "cannot",
    "wont": "will not",
    "its": "it is",
    "im": "i am",
    "ive": "i have",
    "ur": "your",
    "u": "you",
    "pls": "please",
    "plz": "please",
    "thx": "thanks",
    "tnx": "thanks",
    "def": "define",
    "expln": "explain",
}

_WORD_RE = re.compile(r"[a-z0-9][a-z0-9'+\-/*^=().]*", re.IGNORECASE)
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])|\n{2,}")


def normalize(text: str) -> str:
    """Lower-case, strip accents, expand abbreviations and squeeze spaces."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    text = text.lower()

    def _expand(match: "re.Match") -> str:
        word = match.group(0)
        return ABBREVIATIONS.get(word, word)

    text = re.sub(r"[a-z][a-z/]{0,5}", _expand, text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


_SUFFIXES = (
    "ational", "ization", "isation", "iveness", "fulness", "ousness",
    "ations", "ements", "ingly", "edly", "ities", "ment", "ness", "ally",
    "ing", "ers", "est", "ed", "es", "ly", "er",
)


def stem(word: str) -> str:
    """Very light, deterministic Porter-style stemmer.

    It normalises plurals first (studies -> study, vectors -> vector) and then
    strips one common derivational suffix, so closely related word forms map to
    the same token. Character n-gram vectors in :func:`hashing_vector` cover the
    forms this deliberately does not touch (define/definition, react/reaction).
    """
    if len(word) <= 3:
        return word
    if word.endswith("ies") and len(word) > 4:
        word = word[:-3] + "y"
    elif word.endswith("s") and not word.endswith(("ss", "us")) and len(word) > 3:
        word = word[:-1]
    for suffix in _SUFFIXES:
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: len(word) - len(suffix)]
    return word


def raw_tokens(text: str) -> List[str]:
    """Tokens before stemming (used by the intent classifier for readability)."""
    return [t for t in _WORD_RE.findall(normalize(text)) if t]


def tokenize(text: str, keep_stopwords: bool = False) -> List[str]:
    """Normalised, stemmed token list."""
    out: List[str] = []
    for tok in raw_tokens(text):
        if not keep_stopwords and tok in STOPWORDS:
            continue
        if len(tok) <= 1 and not tok.isdigit():
            continue
        out.append(stem(tok))
    return out


def ngrams(tokens: Sequence[str], n: int = 2) -> List[str]:
    return ["_".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def char_ngrams(text: str, n: int = 3) -> List[str]:
    squashed = re.sub(r"\s+", " ", normalize(text))
    if len(squashed) < n:
        return [squashed] if squashed else []
    return [squashed[i:i + n] for i in range(len(squashed) - n + 1)]


# ============================================================
# Vector spaces
# ============================================================

def _l2norm(vec: Dict) -> Dict:
    norm = math.sqrt(sum(v * v for v in vec.values()))
    if norm <= 0:
        return dict(vec)
    return {k: v / norm for k, v in vec.items()}


def hashing_vector(text: str, dims: int = 1024) -> Dict[int, float]:
    """Feature hashing into a fixed-dimension, L2-normalised sparse vector.

    Combines unigrams, bigrams and character trigrams so that paraphrases
    ("solve for x" vs "find the value of x") and small typos still score
    positively against each other.
    """
    vec: Dict[int, float] = defaultdict(float)
    toks = tokenize(text)
    for tok in toks:
        vec[hash(("w", tok)) % dims] += 1.0
    for bigram in ngrams(toks, 2):
        vec[hash(("b", bigram)) % dims] += 1.4
    for trigram in ngrams(toks, 3):
        vec[hash(("t", trigram)) % dims] += 1.1
    for cgram in char_ngrams(text, 3):
        vec[hash(("c", cgram)) % dims] += 0.35
    return _l2norm(vec)


def cosine_sparse(a: Dict[int, float], b: Dict[int, float]) -> float:
    if not a or not b:
        return 0.0
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(k, 0.0) for k, v in a.items())


class TfidfIndex:
    """Incremental TF-IDF index over short documents (questions/answers)."""

    def __init__(self) -> None:
        self.df: Counter = Counter()
        self.doc_tokens: Dict[str, List[str]] = {}
        self.doc_tf: Dict[str, Counter] = {}
        self.vectors: Dict[str, Dict[str, float]] = {}
        self._dirty = True

    def __len__(self) -> int:
        return len(self.doc_tokens)

    @property
    def n_docs(self) -> int:
        return len(self.doc_tokens)

    def add(self, doc_id: str, text: str) -> None:
        if doc_id in self.doc_tokens:
            self.remove(doc_id)
        toks = tokenize(text)
        self.doc_tokens[doc_id] = toks
        self.doc_tf[doc_id] = Counter(toks)
        for term in set(toks):
            self.df[term] += 1
        self._dirty = True

    def remove(self, doc_id: str) -> None:
        if doc_id not in self.doc_tokens:
            return
        for term in set(self.doc_tokens[doc_id]):
            self.df[term] -= 1
            if self.df[term] <= 0:
                del self.df[term]
        self.doc_tokens.pop(doc_id, None)
        self.doc_tf.pop(doc_id, None)
        self.vectors.pop(doc_id, None)
        self._dirty = True

    def idf(self, term: str) -> float:
        n = max(self.n_docs, 1)
        return math.log((1 + n) / (1 + self.df.get(term, 0))) + 1.0

    def _vector(self, tf: Counter) -> Dict[str, float]:
        if not tf:
            return {}
        max_tf = max(tf.values()) or 1
        return {
            term: (0.5 + 0.5 * count / max_tf) * self.idf(term)
            for term, count in tf.items()
        }

    def finalize(self) -> None:
        """Compute (or refresh) document vectors."""
        self.vectors = {}
        for doc_id, tf in self.doc_tf.items():
            self.vectors[doc_id] = _l2norm(self._vector(tf))
        self._dirty = False

    def query_vector(self, query: str) -> Dict[str, float]:
        return _l2norm(self._vector(Counter(tokenize(query))))

    def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.05,
        allowed: Optional[Iterable[str]] = None,
    ) -> List[Tuple[str, float]]:
        if self._dirty or not self.vectors:
            self.finalize()
        qvec = self.query_vector(query)
        if not qvec:
            return []
        allow = set(allowed) if allowed is not None else None
        scored: List[Tuple[str, float]] = []
        for doc_id, vec in self.vectors.items():
            if allow is not None and doc_id not in allow:
                continue
            score = sum(weight * vec.get(term, 0.0) for term, weight in qvec.items())
            if score >= min_score:
                scored.append((doc_id, score))
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return scored[:top_k]


# ============================================================
# Keyword extraction & summarisation
# ============================================================

def keywords(text: str, top_n: int = 10) -> List[str]:
    counts = Counter(tokenize(text))
    return [term for term, _ in counts.most_common(top_n)]


def split_sentences(text: str) -> List[str]:
    if not text:
        return []
    cleaned = re.sub(r"[ \t]+", " ", str(text).replace("\r", "\n"))
    parts = _SENTENCE_RE.split(cleaned)
    out: List[str] = []
    for part in parts:
        for line in part.split("\n"):
            line = line.strip(" \t-*\u2022#")
            if len(line) > 2:
                out.append(line)
    return out


def summarize(text: str, max_sentences: int = 6, query: str = "") -> str:
    """Extractive summariser: TF-IDF sentence scoring + query overlap + position.

    Used as the last-resort "thinking" step when no LLM is reachable: GC AI
    reads the pages it just fetched and composes its own answer.
    """
    sentences = split_sentences(text)
    if not sentences:
        return ""
    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    doc_df: Counter = Counter()
    tokenized = [tokenize(s) for s in sentences]
    for toks in tokenized:
        for term in set(toks):
            doc_df[term] += 1
    n = len(sentences)
    q_terms = set(tokenize(query))

    scored: List[Tuple[float, int, str]] = []
    for idx, (sentence, toks) in enumerate(zip(sentences, tokenized)):
        if not toks:
            continue
        tf = Counter(toks)
        max_tf = max(tf.values()) or 1
        score = 0.0
        for term, count in tf.items():
            term_idf = math.log((1 + n) / (1 + doc_df.get(term, 0))) + 1.0
            score += (0.5 + 0.5 * count / max_tf) * term_idf
        score = score / (len(toks) ** 0.35)
        if q_terms:
            overlap = len(q_terms & set(toks)) / len(q_terms)
            score *= 1.0 + 2.0 * overlap
        if idx == 0:
            score *= 1.15
        scored.append((score, idx, sentence))

    scored.sort(key=lambda item: item[0], reverse=True)
    keep = sorted(scored[:max_sentences], key=lambda item: item[1])
    body = " ".join(sentence for _, _, sentence in keep)
    if len(body) > 3500:
        body = body[:3500].rsplit(" ", 1)[0] + " ..."
    return body


def best_passages(documents: Sequence[Tuple[str, str]], query: str, max_sentences: int = 8) -> str:
    """Pick the most relevant sentences out of a set of (source, text) docs."""
    merged: List[str] = []
    docs = [d for d in documents if d[1]]
    if not docs:
        return ""
    per_doc = max(2, max_sentences // len(docs))
    for _source, text in docs:
        picked = summarize(text, max_sentences=per_doc, query=query)
        if picked:
            merged.append(picked)
    return "\n\n".join(merged)


def answer_overlap(question: str, answer: str) -> float:
    """Jaccard-ish overlap between question and answer terms (relevance guard)."""
    q = set(tokenize(question))
    a = set(tokenize(answer))
    if not q or not a:
        return 0.0
    return len(q & a) / math.sqrt(len(q) * len(a))


# ============================================================
# Subject detection
# ============================================================

SUBJECT_TERMS: Dict[str, Tuple[str, ...]] = {
    "Mathematics": (
        "math", "algebra", "geometry", "calculus", "trigonometry", "matrix",
        "matrices", "vector", "probability", "statistics", "logarithm",
        "differenti", "integr", "quadratic", "equation", "fraction", "surd",
        "polygon", "theorem", "derivative", "limit", "sine", "cosine", "tangent",
    ),
    "Physics": (
        "physic", "newton", "force", "velocity", "acceleration", "momentum",
        "circuit", "resistor", "current", "voltage", "electromagnet", "optic",
        "lens", "wave", "frequency", "wavelength", "thermodynamic",
        "pressure", "density", "energy", "kinetic", "capacitor", "friction",
        "radioactive", "half life", "projectile", "refraction",
    ),
    "Chemistry": (
        "chemistr", "mole", "molar", "titration", "acid", "alkali", "base",
        "electrolys", "oxidation", "reduction", "organic", "alkane", "alkene",
        "hydrocarbon", "periodic table", "isotope", "valency", "bonding",
        "equilibrium", "enthalpy", "reagent", "ph ",
    ),
    "Biology": (
        "biolog", "cell", "dna", "rna", "gene", "genetic", "enzyme",
        "photosynthes", "respiration", "osmosis", "diffusion", "mitosis",
        "meiosis", "organ", "blood", "ecosystem", "bacteria", "virus",
        "hormone", "nervous", "digestive", "excretion", "immunity",
    ),
    "Economics": (
        "econom", "demand", "supply", "inflation", "gdp", "market",
        "elasticity", "monopoly", "tax", "budget", "fiscal", "monetary",
        "utility", "profit", "cost curve", "macroeconomic", "microeconomic",
        "balance of payment",
    ),
    "English Language": (
        "english", "grammar", "essay", "comprehension", "tense", "clause",
        "synonym", "antonym", "punctuation", "paragraph", "lexis", "register",
        "figure of speech", "metaphor", "simile",
    ),
    "French": (
        "french", "francais", "conjugaison", "verbe", "grammaire",
        "composition", "passe compose", "imparfait", "subjonctif", "pronom",
    ),
    "Computer Science": (
        "computer", "programming", "algorithm", "python", "java", "javascript",
        "loop", "array", "database", "sql", "network", "binary", "boolean",
        "compiler", "software", "hardware", "data structure", "html", "css",
        "recursion", "operating system",
    ),
    "Geography": (
        "geograph", "climate", "relief", "erosion", "volcano", "population",
        "agriculture", "mineral", "river", "plateau", "rainfall", "soil",
    ),
    "History": (
        "history", "colonial", "independence", "treaty", "world war", "empire",
        "nationalism", "reunification", "apartheid", "colonisation",
    ),
}


def detect_subject(text: str, default: str = "General") -> str:
    norm = normalize(text)
    scores: Counter = Counter()
    for subject, terms in SUBJECT_TERMS.items():
        for term in terms:
            if term in norm:
                scores[subject] += 1 + len(term.split())
    if not scores:
        return default
    return scores.most_common(1)[0][0]


# ============================================================
# Intent classification (Multinomial Naive Bayes)
# ============================================================

def nb_decision(
    features: Dict[str, int],
    class_counts: Dict[str, int],
    term_counts: Dict[str, Counter],
    vocab_size: int,
) -> Tuple[str, float]:
    """Multinomial Naive Bayes decision from pre-computed statistics.

    Returns (label, confidence). Confidence is a softmax over the log
    likelihoods, which behaves well enough for routing decisions.
    """
    total_docs = max(sum(class_counts.values()), 1)
    vocab_size = max(vocab_size, 1)
    scores: Dict[str, float] = {}
    for label, doc_count in class_counts.items():
        log_prob = math.log(doc_count / total_docs)
        token_total = sum(term_counts[label].values())
        denom = token_total + vocab_size
        for term, count in features.items():
            log_prob += count * math.log((term_counts[label].get(term, 0) + 1) / denom)
        scores[label] = log_prob

    best_label = "general_question"
    best_score = float("-inf")
    for label, value in scores.items():
        if value > best_score:
            best_label, best_score = label, value
    exp_sum = sum(math.exp(v - best_score) for v in scores.values())
    confidence = (1.0 / exp_sum) if exp_sum else 0.0
    return best_label, round(min(max(confidence, 0.0), 0.99), 3)


class IntentClassifier:
    """Small, trainable, persistence friendly intent classifier.

    It is a real (if compact) supervised machine learning model: multinomial
    naive Bayes over unigrams + bigrams with Laplace smoothing. It is trained
    from the seed corpus at boot, learns from every user interaction at
    runtime and can be snapshotted into MongoDB.
    """

    def __init__(self) -> None:
        self.class_counts: Dict[str, int] = defaultdict(int)
        self.term_counts: Dict[str, Counter] = defaultdict(Counter)
        self.examples: List[Tuple[str, str]] = []
        self.vocab: set = set()
        self._learned: List[Tuple[str, str]] = []

    @property
    def trained(self) -> bool:
        return bool(self.class_counts)

    @property
    def labels(self) -> List[str]:
        return sorted(self.class_counts.keys())

    def train(self, examples: Dict[str, Iterable[str]]) -> None:
        for label, phrases in examples.items():
            for phrase in phrases:
                self.add_example(label, phrase)

    def add_example(self, label: str, phrase: str) -> None:
        toks = raw_tokens(phrase)
        if not toks or not label:
            return
        self.class_counts[label] += 1
        for tok in toks:
            self.term_counts[label][tok] += 1
            self.vocab.add(tok)
        for bigram in ngrams(toks, 2):
            self.term_counts[label][bigram] += 1
            self.vocab.add(bigram)
        self.examples.append((label, phrase))

    def learn(self, label: str, phrase: str) -> None:
        """Online learning: remember a labelled utterance (optionally persisted)."""
        self.add_example(label, phrase)
        self._learned.append((label, phrase))
        if len(self._learned) > 200:
            self._learned = self._learned[-200:]

    def predict(self, text: str) -> Tuple[str, float]:
        if not self.trained:
            return "general_question", 0.0
        toks = raw_tokens(text)
        if not toks:
            return "general_question", 0.0
        features: Counter = Counter(toks)
        for bigram in ngrams(toks, 2):
            features[bigram] += 1
        return nb_decision(features, self.class_counts, self.term_counts, len(self.vocab))

    def state(self) -> dict:
        return {
            "class_counts": dict(self.class_counts),
            "term_counts": {k: dict(v) for k, v in self.term_counts.items()},
            "learned": self._learned[-500:],
        }

    def load_state(self, state: dict) -> None:
        """Restore a snapshot produced by :meth:`state`."""
        if not state:
            return
        for label, term_counts in (state.get("term_counts") or {}).items():
            if label in self.class_counts:
                continue
            self.class_counts[label] = int((state.get("class_counts") or {}).get(label, 1))
            for term, count in (term_counts or {}).items():
                self.term_counts[label][term] += int(count)
                self.vocab.add(term)
        for label, phrase in (state.get("learned") or []):
            self.learn(label, phrase)
