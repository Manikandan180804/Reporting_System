import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Incident } from '@/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface GlobalSearchProps {
  onSelectIncident?: (incident: Incident) => void;
}

export default function GlobalSearch({ onSelectIncident }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadIncidents = async () => {
      if (!query.trim()) {
        setIncidents([]);
        return;
      }
      setLoading(true);
      try {
        const data = await api.getIncidents();
        const filtered = data.filter(
          (inc) =>
            inc._id.includes(query) ||
            inc.title.toLowerCase().includes(query.toLowerCase()) ||
            inc.reporterName?.toLowerCase().includes(query.toLowerCase())
        );
        setIncidents(filtered.slice(0, 10));
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(loadIncidents, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-64">
          <Search className="mr-2 h-4 w-4" />
          Search incidents...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search by ID, title, or reporter..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandEmpty>{loading ? 'Searching...' : 'No incidents found'}</CommandEmpty>
          {incidents.length > 0 && (
            <CommandGroup heading="Incidents">
              {incidents.map((inc) => (
                <CommandItem
                  key={inc._id}
                  value={inc._id}
                  onSelect={() => {
                    onSelectIncident?.(inc);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{inc.title}</div>
                    <div className="text-xs text-muted-foreground">{inc._id} • {inc.reporterName}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
