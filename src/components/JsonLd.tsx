/** Structured data (schema.org JSON-LD) for search engines. Rendered as
 *  a script tag in the page, per the Next.js JSON-LD guide; "<" is
 *  escaped so film text can never close the tag. */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
