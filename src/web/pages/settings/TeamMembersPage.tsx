import { useState } from 'react';
import { Users, Plus, Trash2, Search, UserPlus, Shield, Crown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { trpc } from '../../lib/trpc';
import { useAuthStore } from '../../stores/authStore';

const roleDescriptions: Record<string, string> = {
  OWNER: 'Full control over organization and all projects',
  ADMIN: 'Can manage members and all project settings',
  MEMBER: 'Can view and edit project data',
  VIEWER: 'Read-only access to project data',
};

const roleBadgeColors: Record<string, string> = {
  OWNER: 'bg-yellow-500/10 text-yellow-500',
  ADMIN: 'bg-red-500/10 text-red-500',
  MEMBER: 'bg-blue-500/10 text-blue-500',
  VIEWER: 'bg-gray-500/10 text-gray-400',
};

export function TeamMembersPage() {
  const { currentOrganization } = useAuthStore();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Fetch members
  const { data: members, isLoading, error } = trpc.organizations.listMembers.useQuery(
    { organizationId: currentOrganization?.id || '' },
    { enabled: !!currentOrganization?.id }
  );

  // Debug
  console.log('currentOrganization:', currentOrganization);
  console.log('members:', members);
  console.log('error:', error);

  // Search users
  const { data: searchResults } = trpc.organizations.searchUsers.useQuery(
    { query: searchQuery, organizationId: currentOrganization?.id || '' },
    { enabled: searchQuery.length >= 2 && !!currentOrganization?.id }
  );

  // Add member mutation
  const addMemberMutation = trpc.organizations.addMember.useMutation({
    onSuccess: () => {
      utils.organizations.listMembers.invalidate();
      setAddMemberOpen(false);
      setEmail('');
      setRole('MEMBER');
      setSearchQuery('');
    },
  });

  // Update role mutation
  const updateRoleMutation = trpc.organizations.updateMemberRole.useMutation({
    onSuccess: () => {
      utils.organizations.listMembers.invalidate();
    },
  });

  // Remove member mutation
  const removeMemberMutation = trpc.organizations.removeMember.useMutation({
    onSuccess: () => {
      utils.organizations.listMembers.invalidate();
      setDeleteConfirm(null);
    },
  });

  const handleAddMember = () => {
    if (!currentOrganization || !email) return;
    addMemberMutation.mutate({
      organizationId: currentOrganization.id,
      email,
      role,
    });
  };

  const handleSelectUser = (userEmail: string) => {
    setEmail(userEmail);
    setSearchQuery('');
  };

  if (!currentOrganization) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select an organization to manage team members</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Members
          </h1>
          <p className="text-muted-foreground">
            Manage who has access to {currentOrganization.name}
          </p>
        </div>
        <Button onClick={() => setAddMemberOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Members</CardTitle>
          <CardDescription>
            Users with access to all projects in this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-2">Error loading members</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : members && members.length > 0 ? (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {member.user.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt={member.user.name}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-medium text-primary">
                          {member.user.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {member.user.name}
                        {member.role === 'OWNER' && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {member.role === 'OWNER' ? (
                      <span className={`px-3 py-1 rounded text-sm font-medium ${roleBadgeColors[member.role]}`}>
                        Owner
                      </span>
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(value) => {
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: value as 'ADMIN' | 'MEMBER' | 'VIEWER',
                          });
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {member.role !== 'OWNER' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => setDeleteConfirm(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No members added yet</p>
              <Button onClick={() => setAddMemberOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Member
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(roleDescriptions).map(([roleName, description]) => (
              <div key={roleName} className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${roleBadgeColors[roleName]}`}>
                  {roleName}
                </span>
                <span className="text-sm text-muted-foreground">{description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a user to this organization by their email address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={email || searchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.includes('@')) {
                      setEmail(value);
                      setSearchQuery('');
                    } else {
                      setSearchQuery(value);
                      setEmail('');
                    }
                  }}
                  className="pl-9"
                />
              </div>
              {searchResults && searchResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-48 overflow-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      className="w-full p-3 text-left hover:bg-muted flex items-center gap-3"
                      onClick={() => handleSelectUser(user.email)}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">
                    <div>
                      <p className="font-medium">Admin</p>
                      <p className="text-xs text-muted-foreground">Can manage members and settings</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="MEMBER">
                    <div>
                      <p className="font-medium">Member</p>
                      <p className="text-xs text-muted-foreground">Can view and edit project data</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="VIEWER">
                    <div>
                      <p className="font-medium">Viewer</p>
                      <p className="text-xs text-muted-foreground">Read-only access</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addMemberMutation.error && (
              <p className="text-sm text-red-500">
                {addMemberMutation.error.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={!email || addMemberMutation.isPending}
            >
              {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member from the organization?
              They will lose access to all projects immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  removeMemberMutation.mutate({ memberId: deleteConfirm });
                }
              }}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? 'Removing...' : 'Remove Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
