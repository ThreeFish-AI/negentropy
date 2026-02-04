type HeaderProps = {
  title: string;
  connection: string;
  onNewSession: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    roles?: string[];
  } | null;
  onLogin?: () => void;
  onLogout?: () => void;
};

export function Header({ title, connection, onNewSession, user, onLogin, onLogout }: HeaderProps) {
  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Negentropy UI</p>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <div className="flex items-center gap-3">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || user.email || "user"}
                  className="h-8 w-8 rounded-full border border-zinc-200 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
                  {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold">{user.name || user.email}</span>
                <span className="text-[10px] text-zinc-500">{(user.roles || []).join(", ") || "user"}</span>
              </div>
              <button
                className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-700"
                onClick={onLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-700"
              onClick={onLogin}
              type="button"
            >
              Login
            </button>
          )}
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
