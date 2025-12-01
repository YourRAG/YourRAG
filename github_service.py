"""GitHub repository service for fetching and parsing code files."""

import re
import httpx
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class CodeLanguage(Enum):
    """Supported programming languages for smart code splitting."""
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    GO = "go"
    RUST = "rust"
    JAVA = "java"
    CPP = "cpp"
    C = "c"
    CSHARP = "csharp"
    PHP = "php"
    RUBY = "ruby"
    SWIFT = "swift"
    KOTLIN = "kotlin"
    SCALA = "scala"
    LUA = "lua"
    SHELL = "shell"
    SQL = "sql"
    HTML = "html"
    CSS = "css"
    MARKDOWN = "markdown"
    JSON = "json"
    YAML = "yaml"
    TOML = "toml"
    XML = "xml"
    OTHER = "other"


# File extension to language mapping
EXTENSION_MAP: Dict[str, CodeLanguage] = {
    ".py": CodeLanguage.PYTHON,
    ".pyi": CodeLanguage.PYTHON,
    ".js": CodeLanguage.JAVASCRIPT,
    ".jsx": CodeLanguage.JAVASCRIPT,
    ".mjs": CodeLanguage.JAVASCRIPT,
    ".cjs": CodeLanguage.JAVASCRIPT,
    ".ts": CodeLanguage.TYPESCRIPT,
    ".tsx": CodeLanguage.TYPESCRIPT,
    ".mts": CodeLanguage.TYPESCRIPT,
    ".go": CodeLanguage.GO,
    ".rs": CodeLanguage.RUST,
    ".java": CodeLanguage.JAVA,
    ".cpp": CodeLanguage.CPP,
    ".cc": CodeLanguage.CPP,
    ".cxx": CodeLanguage.CPP,
    ".hpp": CodeLanguage.CPP,
    ".c": CodeLanguage.C,
    ".h": CodeLanguage.C,
    ".cs": CodeLanguage.CSHARP,
    ".php": CodeLanguage.PHP,
    ".rb": CodeLanguage.RUBY,
    ".swift": CodeLanguage.SWIFT,
    ".kt": CodeLanguage.KOTLIN,
    ".kts": CodeLanguage.KOTLIN,
    ".scala": CodeLanguage.SCALA,
    ".lua": CodeLanguage.LUA,
    ".sh": CodeLanguage.SHELL,
    ".bash": CodeLanguage.SHELL,
    ".zsh": CodeLanguage.SHELL,
    ".sql": CodeLanguage.SQL,
    ".html": CodeLanguage.HTML,
    ".htm": CodeLanguage.HTML,
    ".css": CodeLanguage.CSS,
    ".scss": CodeLanguage.CSS,
    ".sass": CodeLanguage.CSS,
    ".less": CodeLanguage.CSS,
    ".md": CodeLanguage.MARKDOWN,
    ".markdown": CodeLanguage.MARKDOWN,
    ".json": CodeLanguage.JSON,
    ".yaml": CodeLanguage.YAML,
    ".yml": CodeLanguage.YAML,
    ".toml": CodeLanguage.TOML,
    ".xml": CodeLanguage.XML,
}

# File extensions to include (code files)
CODE_EXTENSIONS = set(EXTENSION_MAP.keys())

# Directories to exclude
EXCLUDED_DIRS = {
    "node_modules", ".git", ".svn", ".hg", "__pycache__", ".pytest_cache",
    ".mypy_cache", ".tox", ".nox", "venv", ".venv", "env", ".env",
    "dist", "build", ".next", ".nuxt", "target", "bin", "obj",
    "vendor", "Pods", ".idea", ".vscode", ".vs", "coverage",
    ".turbo", ".vercel", ".netlify", "out", ".output"
}

# Files to exclude (patterns)
EXCLUDED_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
    "Pipfile.lock", "poetry.lock", "Cargo.lock", "Gemfile.lock",
    ".DS_Store", "Thumbs.db", ".gitignore", ".gitattributes",
    ".editorconfig", ".prettierrc", ".eslintrc", ".babelrc"
}


@dataclass
class CodeChunk:
    """Represents a chunk of code from a file."""
    content: str
    file_path: str
    start_line: int
    end_line: int
    chunk_type: str  # "function", "class", "module", "block"
    language: str
    repo_url: str
    repo_name: str


@dataclass
class RepoFile:
    """Represents a file in a repository."""
    path: str
    size: int
    download_url: str
    sha: str


class GitHubService:
    """Service for interacting with GitHub repositories."""
    
    MAX_FILE_SIZE = 1024 * 1024  # 1MB max file size
    CHUNK_SIZE = 100  # Default lines per chunk for simple splitting
    
    def __init__(self, token: Optional[str] = None):
        self.token = token
        self.headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "YourRAG-CodeBase"
        }
        if token:
            self.headers["Authorization"] = f"Bearer {token}"
    
    def parse_repo_url(self, url: str) -> Tuple[str, str, Optional[str]]:
        """Parse GitHub URL to extract owner, repo name, and optional branch.
        
        Supports formats:
        - https://github.com/owner/repo
        - https://github.com/owner/repo/tree/branch
        - github.com/owner/repo
        """
        url = url.strip().rstrip("/")
        
        # Remove protocol
        url = re.sub(r'^https?://', '', url)
        
        # Remove github.com prefix
        url = re.sub(r'^github\.com/', '', url)
        
        parts = url.split("/")
        if len(parts) < 2:
            raise ValueError("Invalid GitHub URL format")
        
        owner = parts[0]
        repo = parts[1]
        branch = None
        
        # Check for tree/branch format
        if len(parts) >= 4 and parts[2] == "tree":
            branch = parts[3]
        
        return owner, repo, branch
    
    async def get_default_branch(self, owner: str, repo: str) -> str:
        """Get the default branch of a repository."""
        api_url = f"https://api.github.com/repos/{owner}/{repo}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(api_url, headers=self.headers, timeout=30.0)
            
            if response.status_code == 404:
                raise ValueError(f"Repository {owner}/{repo} not found")
            elif response.status_code == 403:
                raise ValueError("GitHub API rate limit exceeded or access denied")
            elif response.status_code != 200:
                raise ValueError(f"Failed to fetch repository info: {response.status_code}")
            
            data = response.json()
            return data.get("default_branch", "main")
    
    async def get_repo_tree(
        self,
        owner: str,
        repo: str,
        branch: Optional[str] = None
    ) -> List[RepoFile]:
        """Get all files in a repository using the Git Trees API."""
        if not branch:
            branch = await self.get_default_branch(owner, repo)
        
        api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(api_url, headers=self.headers, timeout=60.0)
            
            if response.status_code == 404:
                raise ValueError(f"Branch {branch} not found in {owner}/{repo}")
            elif response.status_code == 403:
                raise ValueError("GitHub API rate limit exceeded or access denied")
            elif response.status_code != 200:
                raise ValueError(f"Failed to fetch repository tree: {response.status_code}")
            
            data = response.json()
            
            if data.get("truncated"):
                # Repository is too large, fall back to directory traversal
                return await self._get_repo_contents_recursive(owner, repo, "", branch)
            
            files = []
            for item in data.get("tree", []):
                if item["type"] != "blob":
                    continue
                
                path = item["path"]
                
                # Check if file should be excluded
                if self._should_exclude_file(path):
                    continue
                
                # Check file extension
                ext = self._get_extension(path)
                if ext not in CODE_EXTENSIONS:
                    continue
                
                files.append(RepoFile(
                    path=path,
                    size=item.get("size", 0),
                    download_url=f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}",
                    sha=item["sha"]
                ))
            
            return files
    
    async def _get_repo_contents_recursive(
        self,
        owner: str,
        repo: str,
        path: str,
        branch: str
    ) -> List[RepoFile]:
        """Recursively get repository contents (fallback for large repos)."""
        api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
        if branch:
            api_url += f"?ref={branch}"
        
        files = []
        
        async with httpx.AsyncClient() as client:
            response = await client.get(api_url, headers=self.headers, timeout=30.0)
            
            if response.status_code != 200:
                return files
            
            data = response.json()
            
            if not isinstance(data, list):
                data = [data]
            
            for item in data:
                item_path = item["path"]
                
                if item["type"] == "dir":
                    # Check if directory should be excluded
                    dir_name = item_path.split("/")[-1]
                    if dir_name in EXCLUDED_DIRS:
                        continue
                    
                    # Recursively get contents
                    sub_files = await self._get_repo_contents_recursive(
                        owner, repo, item_path, branch
                    )
                    files.extend(sub_files)
                    
                elif item["type"] == "file":
                    if self._should_exclude_file(item_path):
                        continue
                    
                    ext = self._get_extension(item_path)
                    if ext not in CODE_EXTENSIONS:
                        continue
                    
                    files.append(RepoFile(
                        path=item_path,
                        size=item.get("size", 0),
                        download_url=item.get("download_url", ""),
                        sha=item.get("sha", "")
                    ))
        
        return files
    
    async def get_file_content(self, download_url: str) -> Optional[str]:
        """Download file content from raw URL."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    download_url,
                    headers={"User-Agent": "YourRAG-CodeBase"},
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    return None
                
                # Try to decode as UTF-8
                try:
                    return response.text
                except UnicodeDecodeError:
                    return None
                    
        except Exception:
            return None
    
    def _should_exclude_file(self, path: str) -> bool:
        """Check if a file should be excluded based on path."""
        parts = path.split("/")
        
        # Check directories
        for part in parts[:-1]:
            if part in EXCLUDED_DIRS:
                return True
        
        # Check filename
        filename = parts[-1]
        if filename in EXCLUDED_FILES:
            return True
        
        # Check if it's a hidden file (starts with .)
        if filename.startswith(".") and not filename.endswith(tuple(CODE_EXTENSIONS)):
            return True
        
        return False
    
    def _get_extension(self, path: str) -> str:
        """Get file extension including the dot."""
        if "." not in path:
            return ""
        return "." + path.rsplit(".", 1)[-1].lower()
    
    def detect_language(self, file_path: str) -> CodeLanguage:
        """Detect programming language from file extension."""
        ext = self._get_extension(file_path)
        return EXTENSION_MAP.get(ext, CodeLanguage.OTHER)
    
    def split_code_into_chunks(
        self,
        content: str,
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split code file into semantic chunks based on language."""
        language = self.detect_language(file_path)
        lines = content.split("\n")
        
        if language == CodeLanguage.PYTHON:
            return self._split_python(lines, file_path, repo_url, repo_name)
        elif language in (CodeLanguage.JAVASCRIPT, CodeLanguage.TYPESCRIPT):
            return self._split_js_ts(lines, file_path, repo_url, repo_name, language)
        elif language == CodeLanguage.GO:
            return self._split_go(lines, file_path, repo_url, repo_name)
        elif language == CodeLanguage.RUST:
            return self._split_rust(lines, file_path, repo_url, repo_name)
        elif language in (CodeLanguage.JAVA, CodeLanguage.CSHARP, CodeLanguage.KOTLIN):
            return self._split_java_like(lines, file_path, repo_url, repo_name, language)
        elif language == CodeLanguage.MARKDOWN:
            return self._split_markdown(lines, file_path, repo_url, repo_name)
        elif language in (CodeLanguage.HTML, CodeLanguage.XML):
            return self._split_html_xml(lines, file_path, repo_url, repo_name, language)
        elif language == CodeLanguage.CSS:
            return self._split_css(lines, file_path, repo_url, repo_name)
        elif language in (CodeLanguage.JSON, CodeLanguage.YAML, CodeLanguage.TOML):
            return self._split_config(lines, file_path, repo_url, repo_name, language)
        elif language == CodeLanguage.PHP:
            return self._split_php(lines, file_path, repo_url, repo_name)
        elif language == CodeLanguage.RUBY:
            return self._split_ruby(lines, file_path, repo_url, repo_name)
        elif language == CodeLanguage.SHELL:
            return self._split_shell(lines, file_path, repo_url, repo_name)
        elif language == CodeLanguage.SQL:
            return self._split_sql(lines, file_path, repo_url, repo_name)
        else:
            # Default: split by fixed line count with smart paragraph detection
            return self._split_by_lines(lines, file_path, repo_url, repo_name, language)
    
    def _split_python(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split Python code into chunks based on classes and functions."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "module"
        
        # Patterns for Python
        class_pattern = re.compile(r'^class\s+\w+')
        func_pattern = re.compile(r'^(async\s+)?def\s+\w+')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.lstrip()
            
            # Check for class or top-level function definition
            is_class = class_pattern.match(stripped)
            is_func = func_pattern.match(stripped) and not line.startswith(" ")
            
            if (is_class or is_func) and current_chunk_lines:
                # Save current chunk
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language="python",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                current_chunk_type = "class" if is_class else "function"
            
            current_chunk_lines.append(line)
            i += 1
        
        # Save last chunk
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language="python",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        # If we got too few chunks or file is small, return as single chunk
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="module",
                language="python",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_js_ts(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str,
        language: CodeLanguage
    ) -> List[CodeChunk]:
        """Split JavaScript/TypeScript code into chunks."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "module"
        
        lang_str = "typescript" if language == CodeLanguage.TYPESCRIPT else "javascript"
        
        # Patterns for JS/TS
        func_pattern = re.compile(
            r'^(export\s+)?(async\s+)?(function|const|let|var)\s+\w+|'
            r'^(export\s+)?class\s+\w+'
        )
        
        brace_count = 0
        i = 0
        
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            # Count braces
            brace_count += stripped.count("{") - stripped.count("}")
            
            # Check for function/class definition at top level
            is_definition = func_pattern.match(stripped) and brace_count <= 1
            
            if is_definition and current_chunk_lines and brace_count <= 1:
                # Save current chunk
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language=lang_str,
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                current_chunk_type = "class" if "class " in stripped else "function"
            
            current_chunk_lines.append(line)
            i += 1
        
        # Save last chunk
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language=lang_str,
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="module",
                language=lang_str,
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_go(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split Go code into chunks based on functions and types."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "module"
        
        # Patterns for Go
        func_pattern = re.compile(r'^func\s+')
        type_pattern = re.compile(r'^type\s+\w+\s+(struct|interface)')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            is_func = func_pattern.match(line)
            is_type = type_pattern.match(line)
            
            if (is_func or is_type) and current_chunk_lines:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language="go",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                current_chunk_type = "type" if is_type else "function"
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language="go",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="module",
                language="go",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_rust(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split Rust code into chunks."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "module"
        
        # Patterns for Rust
        func_pattern = re.compile(r'^(pub\s+)?(async\s+)?fn\s+')
        struct_pattern = re.compile(r'^(pub\s+)?struct\s+')
        impl_pattern = re.compile(r'^impl\s+')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            is_func = func_pattern.match(line)
            is_struct = struct_pattern.match(line)
            is_impl = impl_pattern.match(line)
            
            if (is_func or is_struct or is_impl) and current_chunk_lines:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language="rust",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                
                if is_struct:
                    current_chunk_type = "struct"
                elif is_impl:
                    current_chunk_type = "impl"
                else:
                    current_chunk_type = "function"
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language="rust",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="module",
                language="rust",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_java_like(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str,
        language: CodeLanguage
    ) -> List[CodeChunk]:
        """Split Java/C#/Kotlin code into chunks."""
        lang_str = language.value
        
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "module"
        
        # Patterns
        class_pattern = re.compile(r'^(public|private|protected)?\s*(abstract|final)?\s*class\s+')
        method_pattern = re.compile(
            r'^(\s+)(public|private|protected)?\s*(static)?\s*(async)?\s*\w+\s+\w+\s*\('
        )
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            is_class = class_pattern.match(line)
            is_method = method_pattern.match(line)
            
            if (is_class) and current_chunk_lines:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language=lang_str,
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                current_chunk_type = "class"
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language=lang_str,
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="module",
                language=lang_str,
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_by_lines(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str,
        language: CodeLanguage
    ) -> List[CodeChunk]:
        """Split code by fixed line count."""
        lang_str = language.value
        
        # For small files, return as single chunk
        if len(lines) <= self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="block",
                language=lang_str,
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        chunks = []
        for i in range(0, len(lines), self.CHUNK_SIZE):
            chunk_lines = lines[i:i + self.CHUNK_SIZE]
            chunk_content = "\n".join(chunk_lines)
            
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=i + 1,
                    end_line=i + len(chunk_lines),
                    chunk_type="block",
                    language=lang_str,
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        return chunks
    
    def _merge_small_chunks(
        self,
        chunks: List[CodeChunk],
        min_lines: int = 20
    ) -> List[CodeChunk]:
        """Merge small chunks together to avoid too many tiny chunks."""
        if not chunks:
            return chunks
        
        merged = []
        current = chunks[0]
        
        for i in range(1, len(chunks)):
            next_chunk = chunks[i]
            current_lines = current.end_line - current.start_line + 1
            
            # If current chunk is small, merge with next
            if current_lines < min_lines:
                current = CodeChunk(
                    content=current.content + "\n" + next_chunk.content,
                    file_path=current.file_path,
                    start_line=current.start_line,
                    end_line=next_chunk.end_line,
                    chunk_type=current.chunk_type if current_lines > next_chunk.end_line - next_chunk.start_line else next_chunk.chunk_type,
                    language=current.language,
                    repo_url=current.repo_url,
                    repo_name=current.repo_name
                )
            else:
                merged.append(current)
                current = next_chunk
        
        merged.append(current)
        return merged
    
    def _split_markdown(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split Markdown file by headers."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "section"
        
        # Pattern for markdown headers
        header_pattern = re.compile(r'^#{1,3}\s+.+')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Check for header
            is_header = header_pattern.match(line)
            
            if is_header and current_chunk_lines:
                # Save current section
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language="markdown",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                current_chunk_type = "section"
            
            current_chunk_lines.append(line)
            i += 1
        
        # Save last chunk
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language="markdown",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        # If small file or no sections, return as single chunk
        if len(chunks) <= 1 or len(lines) < 50:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="document",
                language="markdown",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks, min_lines=30)
    
    def _split_html_xml(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str,
        language: CodeLanguage
    ) -> List[CodeChunk]:
        """Split HTML/XML by major sections."""
        lang_str = language.value
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        
        # Patterns for major HTML elements
        section_pattern = re.compile(
            r'^\s*<(html|head|body|header|nav|main|section|article|aside|footer|div\s+class|template|script|style)',
            re.IGNORECASE
        )
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            is_section = section_pattern.match(line)
            
            if is_section and current_chunk_lines and len(current_chunk_lines) > 10:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type="element",
                        language=lang_str,
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type="element",
                    language=lang_str,
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="document",
                language=lang_str,
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_css(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split CSS by rule blocks."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        brace_count = 0
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            brace_count += line.count("{") - line.count("}")
            current_chunk_lines.append(line)
            
            # End of a rule block
            if brace_count == 0 and current_chunk_lines and len(current_chunk_lines) >= 5:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=i + 1,
                        chunk_type="rules",
                        language="css",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                current_chunk_lines = []
                current_chunk_start = i + 2
            
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=len(lines),
                    chunk_type="rules",
                    language="css",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="stylesheet",
                language="css",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_config(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str,
        language: CodeLanguage
    ) -> List[CodeChunk]:
        """Split config files (JSON/YAML/TOML) by top-level keys."""
        lang_str = language.value
        
        # For config files, usually keep as single chunk unless very large
        if len(lines) <= 200:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="config",
                language=lang_str,
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        # For large config files, split by sections
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        
        # Pattern for top-level keys in YAML/TOML
        key_pattern = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*\s*[:=]')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Check for top-level key
            is_key = key_pattern.match(line) and not line.startswith(" ") and not line.startswith("\t")
            
            if is_key and current_chunk_lines and len(current_chunk_lines) > 20:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type="section",
                        language=lang_str,
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type="section",
                    language=lang_str,
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="config",
                language=lang_str,
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return chunks
    
    def _split_php(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split PHP code by classes and functions."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "module"
        
        # Patterns for PHP
        class_pattern = re.compile(r'^(abstract\s+|final\s+)?class\s+\w+')
        func_pattern = re.compile(r'^(public|private|protected|static)?\s*(function)\s+\w+')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.lstrip()
            
            is_class = class_pattern.match(stripped)
            is_func = func_pattern.match(stripped) and not line.startswith(" ") and not line.startswith("\t")
            
            if (is_class or is_func) and current_chunk_lines:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language="php",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                current_chunk_type = "class" if is_class else "function"
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language="php",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="module",
                language="php",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_ruby(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split Ruby code by classes and methods."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "module"
        
        # Patterns for Ruby
        class_pattern = re.compile(r'^class\s+\w+')
        module_pattern = re.compile(r'^module\s+\w+')
        def_pattern = re.compile(r'^def\s+\w+')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.lstrip()
            
            is_class = class_pattern.match(stripped) and not line.startswith(" ")
            is_module = module_pattern.match(stripped) and not line.startswith(" ")
            is_def = def_pattern.match(stripped) and not line.startswith(" ")
            
            if (is_class or is_module or is_def) and current_chunk_lines:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language="ruby",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                if is_class:
                    current_chunk_type = "class"
                elif is_module:
                    current_chunk_type = "module"
                else:
                    current_chunk_type = "method"
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language="ruby",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="script",
                language="ruby",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_shell(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split shell scripts by functions."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        current_chunk_type = "script"
        
        # Pattern for shell functions
        func_pattern = re.compile(r'^(\w+)\s*\(\s*\)|^function\s+\w+')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            is_func = func_pattern.match(line)
            
            if is_func and current_chunk_lines:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type=current_chunk_type,
                        language="shell",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
                current_chunk_type = "function"
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type=current_chunk_type,
                    language="shell",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="script",
                language="shell",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    def _split_sql(
        self,
        lines: List[str],
        file_path: str,
        repo_url: str,
        repo_name: str
    ) -> List[CodeChunk]:
        """Split SQL by statements."""
        chunks = []
        current_chunk_lines = []
        current_chunk_start = 1
        
        # Patterns for SQL statements
        statement_pattern = re.compile(
            r'^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|WITH|GRANT|REVOKE)',
            re.IGNORECASE
        )
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            is_statement = statement_pattern.match(line)
            
            if is_statement and current_chunk_lines and len(current_chunk_lines) > 3:
                chunk_content = "\n".join(current_chunk_lines)
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        content=chunk_content,
                        file_path=file_path,
                        start_line=current_chunk_start,
                        end_line=current_chunk_start + len(current_chunk_lines) - 1,
                        chunk_type="statement",
                        language="sql",
                        repo_url=repo_url,
                        repo_name=repo_name
                    ))
                
                current_chunk_lines = []
                current_chunk_start = i + 1
            
            current_chunk_lines.append(line)
            i += 1
        
        if current_chunk_lines:
            chunk_content = "\n".join(current_chunk_lines)
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    content=chunk_content,
                    file_path=file_path,
                    start_line=current_chunk_start,
                    end_line=current_chunk_start + len(current_chunk_lines) - 1,
                    chunk_type="statement",
                    language="sql",
                    repo_url=repo_url,
                    repo_name=repo_name
                ))
        
        if len(chunks) <= 1 or len(lines) < self.CHUNK_SIZE:
            return [CodeChunk(
                content="\n".join(lines),
                file_path=file_path,
                start_line=1,
                end_line=len(lines),
                chunk_type="script",
                language="sql",
                repo_url=repo_url,
                repo_name=repo_name
            )]
        
        return self._merge_small_chunks(chunks)
    
    async def fetch_and_chunk_repo(
        self,
        url: str,
        progress_callback: Optional[callable] = None
    ) -> Tuple[str, List[CodeChunk]]:
        """Fetch a repository and split all code files into chunks.
        
        Returns:
            Tuple of (repo_name, list of code chunks)
        """
        owner, repo, branch = self.parse_repo_url(url)
        repo_name = f"{owner}/{repo}"
        
        if progress_callback:
            progress_callback("Fetching repository structure...", 0, 0)
        
        files = await self.get_repo_tree(owner, repo, branch)
        
        if not files:
            raise ValueError(f"No code files found in repository {repo_name}")
        
        all_chunks = []
        total_files = len(files)
        
        for idx, file in enumerate(files):
            if file.size > self.MAX_FILE_SIZE:
                continue
            
            if progress_callback:
                progress_callback(
                    f"Processing {file.path}...",
                    idx + 1,
                    total_files
                )
            
            content = await self.get_file_content(file.download_url)
            
            if not content:
                continue
            
            try:
                chunks = self.split_code_into_chunks(
                    content,
                    file.path,
                    url,
                    repo_name
                )
                all_chunks.extend(chunks)
            except Exception:
                # If splitting fails, add as single chunk
                all_chunks.append(CodeChunk(
                    content=content,
                    file_path=file.path,
                    start_line=1,
                    end_line=content.count("\n") + 1,
                    chunk_type="module",
                    language=self.detect_language(file.path).value,
                    repo_url=url,
                    repo_name=repo_name
                ))
        
        return repo_name, all_chunks