type HeaderProps = {
  title: string;
  connection: string;
  onNewSession: () => void;
};

export function Header({ title, connection, onNewSession }: HeaderProps) {
  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Negentropy UI</p>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium">{connection}</span>
          <button
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
            onClick={onNewSession}
          >
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}
