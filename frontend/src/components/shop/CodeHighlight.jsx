import { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import php from 'highlight.js/lib/languages/php';
import go from 'highlight.js/lib/languages/go';
import http from 'highlight.js/lib/languages/http';

hljs.registerLanguage('json', json);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('php', php);
hljs.registerLanguage('go', go);
hljs.registerLanguage('http', http);

export const LANG_TO_HL = {
  cURL: 'bash',
  'Node.js': 'javascript',
  Python: 'python',
  PHP: 'php',
  Go: 'go',
};

export default function CodeHighlight({ code, language = 'json' }) {
  const html = useMemo(() => {
    const text = String(code || '').trim();
    if (!text) return '';
    try {
      if (hljs.getLanguage(language)) {
        return hljs.highlight(text, { language }).value;
      }
      return hljs.highlightAuto(text).value;
    } catch {
      return hljs.highlightAuto(text).value;
    }
  }, [code, language]);

  return (
    <pre className="ep-code-block">
      <code
        className={`hljs language-${language}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}
