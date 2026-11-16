import Link from "next/link";
import { namesIn, personSlug } from "@/lib/people";

/** A cast or director line with each name linked to that person's
 *  page. Text that is not a name (for example "No principal cast
 *  listed") is shown as it is. */
export default function PeopleLinks({ text }: { text: string }) {
  const names = namesIn(text);
  if (names.length === 0) return <>{text}</>;
  const parts = text.split(",").map((p) => p.trim());
  return (
    <>
      {parts.map((part, i) => {
        const clean = part.replace(/\([^)]*\)/g, "").trim();
        const linked = names.includes(clean);
        return (
          <span key={`${part}-${i}`}>
            {i > 0 ? ", " : ""}
            {linked ? (
              <>
                <Link className="person-link" href={`/people/${personSlug(clean)}`}>
                  {clean}
                </Link>
                {part.slice(clean.length)}
              </>
            ) : (
              part
            )}
          </span>
        );
      })}
    </>
  );
}
