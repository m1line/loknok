import AuthScreen from '@/components/AuthScreen';
import Messenger from '@/components/Messenger';
import PhoneFrame from '@/components/PhoneFrame';
import { useSession } from '@/hooks/useSession';

export default function App() {
  const { session, loading } = useSession();

  return (
    <PhoneFrame>
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-500" />
        </div>
      )}
      {!loading && !session && <AuthScreen />}
      {!loading && session && <Messenger key={session.user.id} userId={session.user.id} />}
    </PhoneFrame>
  );
}
