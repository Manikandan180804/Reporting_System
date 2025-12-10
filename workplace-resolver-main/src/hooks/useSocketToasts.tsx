import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export default function useSocketToasts() {
  useEffect(() => {
    const onAssigned = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      const title = detail && detail._id ? `Incident ${detail._id} assigned` : 'Incident assigned';
      toast({ title, description: detail?.assigneeName ? `Assigned to ${detail.assigneeName}` : undefined });
    };

    const onUpdated = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      const id = detail?._id || detail?.incidentId || 'an incident';
      toast({ title: 'Incident updated', description: `Update for ${id}` });
    };

    const onComment = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      const id = detail?.incidentId || 'an incident';
      toast({ title: 'New comment', description: `New comment on ${id}` });
    };

    window.addEventListener('socket:incident.assigned', onAssigned as EventListener);
    window.addEventListener('socket:incident.updated', onUpdated as EventListener);
    window.addEventListener('socket:comment.added', onComment as EventListener);

    return () => {
      window.removeEventListener('socket:incident.assigned', onAssigned as EventListener);
      window.removeEventListener('socket:incident.updated', onUpdated as EventListener);
      window.removeEventListener('socket:comment.added', onComment as EventListener);
    };
  }, []);
}
