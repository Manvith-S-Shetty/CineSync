import './ErrorCard.css';

export default function ErrorCard({ message, retry, continueWithoutCamera }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white text-black rounded-xl shadow-lg p-6 w-[320px] text-center">
        <h2 className="text-lg font-semibold mb-2">Error</h2>
        <p className="text-sm mb-4">{message}</p>
        <div className="flex gap-2 justify-center">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={retry || (() => window.location.reload())}>
            Try Again
          </button>
          <button className="px-4 py-2 bg-gray-200 rounded" onClick={continueWithoutCamera || (() => window.location.reload())}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
