import { useEffect, useRef } from 'react';
import { api } from '@/services/api';

interface Options {
  interval?: number;
}

// Poll assigned incidents and call `onChange` when the dataset changes
export default function useAssignedIncidentsPoll(onChange: (data: any[]) => void, options?: Options) {
  const intervalRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef<string | null>(null);
  const pollingInterval = options?.interval ?? 5000;

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const data = await api.getAssignedIncidents();
        const snap = JSON.stringify(data.map((d) => ({ _id: d._id, updatedAt: d.updatedAt }))); // lightweight snapshot
        if (lastSnapshotRef.current !== snap) {
          lastSnapshotRef.current = snap;
          onChange(data);
        }
      } catch (err) {
        // ignore polling errors; calling code may display errors on manual load
        // console.warn('Polling error', err);
      }
    };

    // initial check
    if (mounted) check();

    intervalRef.current = window.setInterval(check, pollingInterval);

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onChange, pollingInterval]);
}
