import type { JSX } from 'react';

export function NotificationSettings({ workspaceId, principal, startHour, endHour }: Readonly<{ workspaceId: string; principal: string; startHour: number; endHour: number }>): JSX.Element {
  return <section aria-label="Notification settings"><h2>Quiet hours</h2><p>{workspaceId}</p><p>{principal}</p><p>{startHour}:00–{endHour}:00</p><p>Emergency notifications may bypass quiet hours and are audited.</p></section>;
}
