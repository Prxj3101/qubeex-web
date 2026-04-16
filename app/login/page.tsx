import { LoginForm } from '@/components/auth/LoginForm';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export default function LoginPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-background relative">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <LoginForm />
        </main>
    );
}