import { ShieldCheck } from "lucide-react";

export function HomePage() {
  return (
    <main className="open-for-editing">
      <ShieldCheck aria-hidden="true" className="open-for-editing__icon" strokeWidth={1.8} />
      <h1>Open for Editing</h1>
      <p>Agent: edit this page freely and keep it simple.</p>
    </main>
  );
}
