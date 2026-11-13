import { requireChatGPTUser } from './chatgpt-auth';
import ParkingApp from './parking-app';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireChatGPTUser('/');
  // This server component runs once per request; seed the browser clock from the server.
  // eslint-disable-next-line react-hooks/purity
  return <ParkingApp operator={user.displayName} initialNow={Date.now()} />;
}
