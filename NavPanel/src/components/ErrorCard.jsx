import './ErrorCard.css';

export default function ErrorCard({ message, retry, continueWithoutCamera }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in z-50">
      <div className="bg-white text-black rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.3)] p-6 w-[320px] text-center animate-modal-in">
        <h2 className="text-lg font-semibold mb-2">Error</h2>
        <p className="text-sm mb-4 text-gray-700">{message}</p>
        <div className="flex gap-2 justify-center">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm transition-all duration-200 ease-apple hover:-translate-y-[1px] hover:scale-[1.02] hover:shadow-md active:scale-[0.98]" onClick={retry || (() => window.location.reload())}>
            Try Again
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg shadow-sm transition-all duration-200 ease-apple hover:-translate-y-[1px] hover:scale-[1.02] hover:shadow-md active:scale-[0.98]" onClick={continueWithoutCamera || (() => window.location.reload())}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
