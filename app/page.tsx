import { requireChatGPTUser } from './chatgpt-auth';
import ParkingApp from './parking-app';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireChatGPTUser('/');
  return <ParkingApp operator={user.displayName} initialNow={Date.now()} />;
}
