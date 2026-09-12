// Shared fixed-position container for every bottom-corner toast on this
// page (stale score, unconfirmed skill matches, ...) — a single positioned
// wrapper so multiple toasts stack vertically with a real gap instead of
// each toast positioning itself independently and overlapping the others.
export function ToastStack({ children }) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-3 px-4 sm:items-end sm:pr-6">
      {children}
    </div>
  );
}
