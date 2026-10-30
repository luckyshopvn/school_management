import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { normalizeMathDelimiters } from './ai-tutor-math.js';

// Câu trả lời của gia sư AI: Markdown kèm công thức KaTeX (react-markdown, remark-math, rehype-katex, katex: giấy phép MIT).
// react-markdown không hiển thị HTML thô trong câu trả lời
export function TutorMarkdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 break-words [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {normalizeMathDelimiters(text)}
      </ReactMarkdown>
    </div>
  );
}
