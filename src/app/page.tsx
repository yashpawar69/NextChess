import ChessboardGame from '@/components/ChessboardGame';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="py-4 px-6 bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-3xl font-bold font-headline">
            NextChess
          </Link>
          <ThemeToggleButton />
        </div>
      </header>

      <main className="flex-grow container mx-auto py-8 px-4">
        <ChessboardGame />
      </main>

      <footer className="py-6 text-center bg-primary text-primary-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} NextChess. Play responsibly.</p>
      </footer>
    </div>
  );
}
