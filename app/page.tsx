import Header from "@/components/Header";
import PostGeneratorForm from "@/components/PostGeneratorForm";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            Read less. Join the conversation.
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Three good ways to reply
          </h1>
          <p className="text-sm font-normal text-slate-600 leading-relaxed">
            Paste a post. Get the point, compare three different comments, and choose the one you want to say.
          </p>
        </div>
        <PostGeneratorForm />
      </main>
      <footer className="py-6 border-t border-slate-200/80 text-center text-xs font-normal text-slate-400">
        humix &copy; {new Date().getFullYear()} &bull; Your choice. Your conversation.
      </footer>
    </div>
  );
}
