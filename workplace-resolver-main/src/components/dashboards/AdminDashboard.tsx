import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { RoutingRule, User } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Plus, Settings, Users, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CreateRoutingRuleDialog from '@/components/admin/CreateRoutingRuleDialog';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateRuleDialog, setShowCreateRuleDialog] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<RoutingRule | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rulesData, usersData] = await Promise.all([api.getRoutingRules(), api.getUsers()]);
      setRoutingRules(rulesData);
      setUsers(usersData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.deleteRoutingRule(id);
      toast({
        title: 'Success',
        description: 'Routing rule deleted',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete routing rule',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (ruleId: string, newVal: boolean) => {
    try {
      await api.updateRoutingRule(ruleId, { active: newVal });
      toast({ title: 'Success', description: `Routing rule ${newVal ? 'enabled' : 'disabled'}` });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Console</h1>
          <p className="text-muted-foreground">Manage routing rules and view system overview</p>
        </div>

        <Tabs defaultValue="routing" className="space-y-6">
          <TabsList>
            <TabsTrigger value="routing">
              <Settings className="mr-2 h-4 w-4" />
              Routing Rules
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="routing" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Routing Rules</h2>
              <Button onClick={() => setShowCreateRuleDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </div>

            {loading ? (
              <div className="text-center text-muted-foreground">Loading...</div>
            ) : routingRules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No routing rules configured</p>
                  <Button onClick={() => setShowCreateRuleDialog(true)} className="mt-4">
                    Create First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...routingRules]
                  .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
                  .map((rule) => (
                    <Card key={rule._id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{rule.category}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={rule.active === false ? 'secondary' : 'default'}>
                              {rule.active === false ? 'Inactive' : 'Active'}
                            </Badge>
                          </div>
                        </div>
                        <CardDescription>
                          Routes to: {rule.assignedTeam}
                          <div className="text-xs text-muted-foreground mt-1">Priority: {rule.priority ?? 0}</div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">Enabled</div>
                            <Switch checked={rule.active !== false} onCheckedChange={(val) => handleToggleActive(rule._id, !!val)} />
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setRuleToEdit(rule); setShowCreateRuleDialog(true); }}
                            className="w-full"
                          >
                            Edit Rule
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="w-full">Delete Rule</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete routing rule</AlertDialogTitle>
                                <AlertDialogDescription>Are you sure you want to delete the routing rule for "{rule.category}"? This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteRule(rule._id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <h2 className="text-xl font-semibold">Users</h2>

            {loading ? (
              <div className="text-center text-muted-foreground">Loading...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                  <Card key={user._id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{user.name}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Role:</span>
                        <Badge>{user.role}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateRoutingRuleDialog
        open={showCreateRuleDialog}
        onOpenChange={(open) => {
          setShowCreateRuleDialog(open);
          if (!open) setRuleToEdit(null);
        }}
        onSuccess={loadData}
        ruleToEdit={ruleToEdit}
      />
    </DashboardLayout>
  );
}
