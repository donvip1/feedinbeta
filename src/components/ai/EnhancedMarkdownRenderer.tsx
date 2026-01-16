import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Copy, ChevronDown, ChevronRight, Info, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EnhancedMarkdownRendererProps {
  content: string;
  className?: string;
  animate?: boolean;
}

// Detect and render math expressions
const MathRenderer = ({ content }: { content: string }) => {
  // Check for block math ($$...$$)
  if (content.startsWith('$$') && content.endsWith('$$')) {
    const math = content.slice(2, -2).trim();
    return <BlockMath math={math} />;
  }
  // Check for inline math ($...$)
  if (content.startsWith('$') && content.endsWith('$') && !content.startsWith('$$')) {
    const math = content.slice(1, -1).trim();
    return <InlineMath math={math} />;
  }
  return null;
};

// Code block with copy button and syntax highlighting
const CodeBlock = ({ 
  language, 
  children 
}: { 
  language: string | undefined; 
  children: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-border/50 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border/50">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          {language || 'code'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
              <span className="text-xs text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </Button>
      </div>
      
      {/* Code */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'hsl(var(--card))',
          fontSize: '0.875rem',
          borderRadius: 0,
        }}
        showLineNumbers={children.split('\n').length > 3}
        wrapLines
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
};

// Collapsible section for long content
const CollapsibleSection = ({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-border/50 rounded-lg my-3 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="font-medium text-sm">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 border-t border-border/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Info/Warning/Tip boxes
const CalloutBox = ({ 
  type, 
  children 
}: { 
  type: 'info' | 'warning' | 'tip' | 'success'; 
  children: React.ReactNode;
}) => {
  const styles = {
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: <Info className="w-5 h-5 text-blue-500" />,
      title: 'Info'
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      title: 'Warning'
    },
    tip: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      icon: <Lightbulb className="w-5 h-5 text-purple-500" />,
      title: 'Tip'
    },
    success: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      title: 'Success'
    }
  };

  const style = styles[type];

  return (
    <div className={cn(
      'flex gap-3 p-4 rounded-lg border my-4',
      style.bg,
      style.border
    )}>
      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
};

export const EnhancedMarkdownRenderer = ({ 
  content, 
  className,
  animate = false 
}: EnhancedMarkdownRendererProps) => {
  // Pre-process content to detect callouts
  const processedContent = content
    .replace(/:::info\n([\s\S]*?):::/g, '<callout-info>$1</callout-info>')
    .replace(/:::warning\n([\s\S]*?):::/g, '<callout-warning>$1</callout-warning>')
    .replace(/:::tip\n([\s\S]*?):::/g, '<callout-tip>$1</callout-tip>')
    .replace(/:::success\n([\s\S]*?):::/g, '<callout-success>$1</callout-success>');

  return (
    <motion.div 
      className={cn('prose prose-sm max-w-none dark:prose-invert', className)}
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <ReactMarkdown
        components={{
          // Headers with gradient accents
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-8 mb-4 text-foreground bg-gradient-to-r from-primary to-primary-foreground/80 bg-clip-text">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-6 mb-3 text-foreground flex items-center gap-2">
              <span className="w-1 h-6 bg-primary rounded-full" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h4>
          ),
          
          // Paragraphs with better spacing
          p: ({ children }) => {
            // Check for math expressions in paragraph
            const childText = typeof children === 'string' ? children : '';
            if (childText.includes('$')) {
              const parts = childText.split(/(\$\$?[^$]+\$\$?)/g);
              return (
                <p className="mb-4 leading-relaxed text-foreground">
                  {parts.map((part, i) => {
                    if (part.startsWith('$')) {
                      return <MathRenderer key={i} content={part} />;
                    }
                    return part;
                  })}
                </p>
              );
            }
            return (
              <p className="mb-4 leading-relaxed text-foreground">{children}</p>
            );
          },
          
          // Enhanced lists
          ul: ({ children }) => (
            <ul className="list-none space-y-2 mb-4 pl-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-none space-y-2 mb-4 pl-0 counter-reset-item">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-3 text-foreground">
              <span className={cn(
                "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mt-0.5",
                "bg-primary/10 text-primary"
              )}>
                •
              </span>
              <span className="flex-1">{children}</span>
            </li>
          ),
          
          // Bold and italic
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/90">{children}</em>
          ),
          
          // Code blocks with syntax highlighting
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !className;
            
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded-md text-sm font-mono text-primary border border-border/50">
                  {children}
                </code>
              );
            }
            
            return (
              <CodeBlock language={match?.[1]}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          },
          pre: ({ children }) => <>{children}</>,
          
          // Blockquote with style
          blockquote: ({ children }) => (
            <blockquote className="relative border-l-4 border-primary pl-4 py-2 my-4 bg-primary/5 rounded-r-lg italic">
              <div className="absolute -left-2.5 top-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-xs">"</span>
              </div>
              <div className="text-muted-foreground">{children}</div>
            </blockquote>
          ),
          
          // Horizontal rule
          hr: () => (
            <hr className="my-6 border-none h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          ),
          
          // Links
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors"
            >
              {children}
            </a>
          ),
          
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-border/50 shadow-sm">
              <table className="min-w-full divide-y divide-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/50 bg-card">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm">{children}</td>
          ),
          
          // Images
          img: ({ src, alt }) => (
            <figure className="my-4">
              <img 
                src={src} 
                alt={alt} 
                className="rounded-lg border border-border/50 shadow-md max-w-full h-auto"
              />
              {alt && (
                <figcaption className="text-center text-xs text-muted-foreground mt-2 italic">
                  {alt}
                </figcaption>
              )}
            </figure>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </motion.div>
  );
};

export default EnhancedMarkdownRenderer;
