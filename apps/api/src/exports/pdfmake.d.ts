// Khai báo tối thiểu của pdfmake 0.3 phần máy chủ dùng (DT-16 phần 16a). Không dùng @types/pdfmake vì gói đó kéo theo thư
// viện kiểu của trình duyệt (lib dom) làm sai kiểu Blob, Buffer ở các tệp khác
declare module 'pdfmake' {
  export type PdfContent = Record<string, unknown> | string | PdfContent[];

  export interface PdfDocumentDefinition {
    content: PdfContent[];
    [key: string]: unknown;
  }

  interface PdfMake {
    virtualfs: { writeFileSync(name: string, body: Buffer): void };
    setFonts(fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>): void;
    setUrlAccessPolicy(callback: (url: string) => boolean): void;
    setLocalAccessPolicy(callback: (path: string) => boolean): void;
    createPdf(definition: PdfDocumentDefinition): { getBuffer(): Promise<Buffer> };
  }

  const pdfmake: PdfMake;
  export default pdfmake;
}
