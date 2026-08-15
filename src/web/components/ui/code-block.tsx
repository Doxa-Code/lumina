import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  className?: string;
}

// Simple syntax highlighting for common languages
function highlightCode(code: string, language: string): string {
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const escaped = escapeHtml(code);

  const patterns: Record<string, { pattern: RegExp; className: string }[]> = {
    typescript: [
      { pattern: /(\/\/.*$)/gm, className: 'text-gray-500' }, // Comments
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'text-gray-500' }, // Multi-line comments
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, className: 'text-emerald-400' }, // Strings
      { pattern: /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|new|async|await|try|catch|throw|typeof|instanceof)\b/g, className: 'text-purple-400' }, // Keywords
      { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, className: 'text-orange-400' }, // Literals
      { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' }, // Numbers
      { pattern: /(@\w+)/g, className: 'text-yellow-400' }, // Decorators
      { pattern: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'text-cyan-400' }, // Types/Classes
    ],
    javascript: [
      { pattern: /(\/\/.*$)/gm, className: 'text-gray-500' },
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, className: 'text-emerald-400' },
      { pattern: /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|new|async|await|try|catch|throw|typeof|instanceof|require)\b/g, className: 'text-purple-400' },
      { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, className: 'text-orange-400' },
      { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' },
    ],
    python: [
      { pattern: /(#.*$)/gm, className: 'text-gray-500' },
      { pattern: /('''[\s\S]*?'''|"""[\s\S]*?""")/g, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, className: 'text-emerald-400' },
      { pattern: /\b(import|from|as|def|return|if|elif|else|for|while|class|with|try|except|raise|lambda|yield|async|await|True|False|None)\b/g, className: 'text-purple-400' },
      { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' },
      { pattern: /@(\w+)/g, className: 'text-yellow-400' },
    ],
    go: [
      { pattern: /(\/\/.*$)/gm, className: 'text-gray-500' },
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`]*`)/g, className: 'text-emerald-400' },
      { pattern: /\b(package|import|func|return|if|else|for|range|switch|case|default|var|const|type|struct|interface|map|chan|go|defer|select|break|continue|fallthrough|goto)\b/g, className: 'text-purple-400' },
      { pattern: /\b(true|false|nil|iota)\b/g, className: 'text-orange-400' },
      { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' },
    ],
    bash: [
      { pattern: /(#.*$)/gm, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, className: 'text-emerald-400' },
      { pattern: /\b(curl|npm|pip|go|docker|export|echo|cd|ls|mkdir|rm|cp|mv)\b/g, className: 'text-purple-400' },
      { pattern: /(-[a-zA-Z]+|--[a-zA-Z-]+)/g, className: 'text-cyan-400' },
      { pattern: /(\$\w+|\$\{[^}]+\})/g, className: 'text-yellow-400' },
    ],
    java: [
      { pattern: /(\/\/.*$)/gm, className: 'text-gray-500' },
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, className: 'text-emerald-400' },
      { pattern: /\b(import|package|public|private|protected|class|interface|extends|implements|new|return|if|else|for|while|try|catch|throw|throws|static|final|void|int|long|double|float|boolean|String)\b/g, className: 'text-purple-400' },
      { pattern: /\b(true|false|null)\b/g, className: 'text-orange-400' },
      { pattern: /\b(\d+\.?\d*[dDfFlL]?)\b/g, className: 'text-orange-400' },
      { pattern: /@(\w+)/g, className: 'text-yellow-400' },
    ],
    ruby: [
      { pattern: /(#.*$)/gm, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, className: 'text-emerald-400' },
      { pattern: /\b(require|require_relative|def|end|class|module|if|elsif|else|unless|case|when|while|until|for|do|return|yield|begin|rescue|ensure|raise)\b/g, className: 'text-purple-400' },
      { pattern: /\b(true|false|nil)\b/g, className: 'text-orange-400' },
      { pattern: /(:\w+)/g, className: 'text-cyan-400' },
      { pattern: /(@\w+)/g, className: 'text-yellow-400' },
    ],
    rust: [
      { pattern: /(\/\/.*$)/gm, className: 'text-gray-500' },
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, className: 'text-emerald-400' },
      { pattern: /\b(use|mod|pub|fn|let|mut|const|static|struct|enum|impl|trait|where|for|loop|while|if|else|match|return|async|await|move|unsafe|extern|crate|self|super|dyn|ref|in)\b/g, className: 'text-purple-400' },
      { pattern: /\b(true|false|None|Some|Ok|Err)\b/g, className: 'text-orange-400' },
      { pattern: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' },
      { pattern: /(#\[[\w(,\s="']+\])/g, className: 'text-yellow-400' },
    ],
    php: [
      { pattern: /(\/\/.*$|#.*$)/gm, className: 'text-gray-500' },
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, className: 'text-emerald-400' },
      { pattern: /\b(use|namespace|class|function|return|if|else|elseif|for|foreach|while|try|catch|throw|new|public|private|protected|static|final|abstract|extends|implements|require|include)\b/g, className: 'text-purple-400' },
      { pattern: /\b(true|false|null)\b/g, className: 'text-orange-400' },
      { pattern: /(\$\w+)/g, className: 'text-yellow-400' },
    ],
    dotnet: [
      { pattern: /(\/\/.*$)/gm, className: 'text-gray-500' },
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'text-gray-500' },
      { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, className: 'text-emerald-400' },
      { pattern: /\b(using|namespace|class|public|private|protected|internal|static|void|var|new|return|if|else|for|foreach|while|try|catch|throw|async|await|interface|struct|enum|delegate|event|override|virtual|abstract|sealed|partial)\b/g, className: 'text-purple-400' },
      { pattern: /\b(true|false|null)\b/g, className: 'text-orange-400' },
      { pattern: /\b(\d+\.?\d*[dDfFmM]?)\b/g, className: 'text-orange-400' },
      { pattern: /\[(\w+)\]/g, className: 'text-yellow-400' },
    ],
  };

  // Normalize language aliases
  const langMap: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sh: 'bash',
    shell: 'bash',
    csharp: 'dotnet',
    'c#': 'dotnet',
  };

  const normalizedLang = langMap[language.toLowerCase()] || language.toLowerCase();
  const langPatterns = patterns[normalizedLang];

  if (!langPatterns) {
    return escaped;
  }

  // Apply syntax highlighting
  let highlighted = escaped;

  // Use a placeholder system to prevent double-replacing
  const placeholders: string[] = [];

  for (const { pattern, className } of langPatterns) {
    highlighted = highlighted.replace(pattern, (match) => {
      const index = placeholders.length;
      placeholders.push(`<span class="${className}">${match}</span>`);
      return `__PLACEHOLDER_${index}__`;
    });
  }

  // Replace placeholders with actual spans
  for (let i = 0; i < placeholders.length; i++) {
    highlighted = highlighted.replace(`__PLACEHOLDER_${i}__`, placeholders[i]);
  }

  return highlighted;
}

export function CodeBlock({
  code,
  language = 'typescript',
  title,
  showLineNumbers = true,
  highlightLines = [],
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');
  const highlightedCode = highlightCode(code, language);
  const highlightedLines = highlightedCode.split('\n');

  return (
    <div className={cn('rounded-lg overflow-hidden border border-border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          {/* Colored dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          {title && (
            <span className="text-sm text-muted-foreground font-medium">{title}</span>
          )}
          <span className="text-xs text-muted-foreground/60 uppercase tracking-wide">
            {language}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto bg-[#0d1117]">
        <pre className="p-4 text-sm font-mono leading-relaxed">
          <code>
            {highlightedLines.map((line, index) => {
              const lineNumber = index + 1;
              const isHighlighted = highlightLines.includes(lineNumber);

              return (
                <div
                  key={index}
                  className={cn(
                    'flex',
                    isHighlighted && 'bg-yellow-500/10 -mx-4 px-4 border-l-2 border-yellow-500'
                  )}
                >
                  {showLineNumbers && (
                    <span className="select-none w-8 text-right pr-4 text-gray-600 flex-shrink-0">
                      {lineNumber}
                    </span>
                  )}
                  <span
                    className="flex-1 text-gray-300"
                    dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
                  />
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
