interface PageErrorProps {
  message: string;
  showLoginLink?: boolean;
}

export default function PageError({ message, showLoginLink = false }: PageErrorProps) {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4">
      {showLoginLink ? (
        <div className="text-center">
          <p className="text-red-500 mb-4">{message}</p>
          <a href="/login" className="text-emerald-primary font-medium hover:underline">Back to login</a>
        </div>
      ) : (
        <p className="text-red-500">{message}</p>
      )}
    </main>
  );
}
