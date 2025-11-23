import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { User, RoutingRule } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface CreateRoutingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  ruleToEdit?: RoutingRule | null;
}

export default function CreateRoutingRuleDialog({ open, onOpenChange, onSuccess, ruleToEdit }: CreateRoutingRuleDialogProps) {
  const [category, setCategory] = useState('');
  const [assignedTeam, setAssignedTeam] = useState('');
  const [assignedTo, setAssignedTo] = useState('unassigned');
  const [priority, setPriority] = useState<number | ''>('');
  const [active, setActive] = useState(true);
  const [responders, setResponders] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadResponders();
    }
  }, [open]);

  useEffect(() => {
    // Populate fields when editing
    if (open && ruleToEdit) {
      setCategory(ruleToEdit.category || '');
      setAssignedTeam(ruleToEdit.assignedTeam || '');
      setAssignedTo(ruleToEdit.assignedTo || 'unassigned');
      setPriority(typeof ruleToEdit.priority === 'number' ? ruleToEdit.priority : '');
      setActive(ruleToEdit.active !== false);
    }
    if (!open) {
      // reset when closing
      setCategory('');
      setAssignedTeam('');
      setAssignedTo('unassigned');
      setPriority('');
      setActive(true);
    }
  }, [open]);


  const loadResponders = async () => {
    try {
      const data = await api.getResponders();
      setResponders(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load responders',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!category || !assignedTeam) {
      toast({
        title: 'Error',
        description: 'Category and Team are required',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);

    try {
      const assignedToValue = assignedTo === 'unassigned' ? undefined : assignedTo;

      if (ruleToEdit && ruleToEdit._id) {
        await api.updateRoutingRule(ruleToEdit._id, {
          category: category as any,
          assignedTeam,
          assignedTo: assignedToValue,
          priority: priority === '' ? undefined : Number(priority),
          active,
        });
      } else {
        await api.createRoutingRule({
          category: category as any,
          assignedTeam,
          assignedTo: assignedToValue,
          priority: priority === '' ? undefined : Number(priority),
          active,
        });
      }

      toast({
        title: 'Success',
        description: ruleToEdit ? 'Routing rule updated successfully' : 'Routing rule created successfully',
      });

      setCategory('');
      setAssignedTeam('');
      setAssignedTo('unassigned');
      setPriority('');
      setActive(true);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: error.message || (ruleToEdit ? 'Failed to update routing rule' : 'Failed to create routing rule'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ruleToEdit ? 'Edit Routing Rule' : 'Create Routing Rule'}</DialogTitle>
          <DialogDescription>Define how incidents should be routed based on category</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="Facility">Facility</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">Assigned Team</Label>
            <Input
              id="team"
              placeholder="e.g., IT Support Team"
              value={assignedTeam}
              onChange={(e) => setAssignedTeam(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responder">Assign to Responder (Optional)</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger id="responder">
                <SelectValue placeholder="Select responder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">None</SelectItem>
                {responders.map((responder) => (
                  <SelectItem key={responder._id} value={responder._id}>
                    {responder.name} - {responder.department || 'No department'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority (lower = higher)</Label>
            <Input
              id="priority"
              placeholder="0"
              value={priority as any}
              onChange={(e) => setPriority(e.target.value === '' ? '' : Number(e.target.value))}
              type="number"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={(val) => setActive(!!val)} />
            <Label htmlFor="active">Active</Label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (ruleToEdit ? 'Saving...' : 'Creating...') : (ruleToEdit ? 'Save Changes' : 'Create Rule')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
