import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Send, Mail, MessageSquare, Webhook, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';
import { useToast } from '../../hooks/useToast';

type ChannelType = 'slack' | 'email' | 'webhook' | 'pagerduty';

interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  config: Record<string, any>;
  enabled: boolean;
  createdAt: string;
}

const CHANNEL_TYPES: Record<
  ChannelType,
  {
    label: string;
    icon: typeof Mail;
    description: string;
    configFields: Array<{
      name: string;
      label: string;
      type: string;
      placeholder: string;
      required: boolean;
    }>;
  }
> = {
  slack: {
    label: 'Slack',
    icon: MessageSquare,
    description: 'Send notifications to a Slack channel',
    configFields: [
      {
        name: 'webhookUrl',
        label: 'Webhook URL',
        type: 'url',
        placeholder: 'https://hooks.slack.com/services/...',
        required: true,
      },
      {
        name: 'channel',
        label: 'Channel',
        type: 'text',
        placeholder: '#alerts',
        required: false,
      },
    ],
  },
  email: {
    label: 'Email',
    icon: Mail,
    description: 'Send notifications via email',
    configFields: [
      {
        name: 'recipients',
        label: 'Recipients (comma-separated)',
        type: 'text',
        placeholder: 'email@example.com, another@example.com',
        required: true,
      },
      {
        name: 'fromEmail',
        label: 'From Address',
        type: 'email',
        placeholder: 'alerts@yourcompany.com',
        required: false,
      },
    ],
  },
  webhook: {
    label: 'Webhook',
    icon: Webhook,
    description: 'Send HTTP POST requests to a custom endpoint',
    configFields: [
      {
        name: 'url',
        label: 'Webhook URL',
        type: 'url',
        placeholder: 'https://api.example.com/webhooks/alerts',
        required: true,
      },
      {
        name: 'headers',
        label: 'Custom Headers (JSON)',
        type: 'textarea',
        placeholder: '{"Authorization": "Bearer token"}',
        required: false,
      },
    ],
  },
  pagerduty: {
    label: 'PagerDuty',
    icon: AlertCircle,
    description: 'Create incidents in PagerDuty',
    configFields: [
      {
        name: 'routingKey',
        label: 'Routing Key (32 characters)',
        type: 'password',
        placeholder: 'Your PagerDuty routing key',
        required: true,
      },
      {
        name: 'severity',
        label: 'Default Severity',
        type: 'select',
        placeholder: 'error',
        required: false,
      },
    ],
  },
};

function CreateChannelDialog({
  editChannel,
  onSubmit,
}: {
  editChannel?: Channel | null;
  onSubmit: (channel: Partial<Channel>) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<ChannelType>(
    editChannel?.type || 'slack'
  );

  // Transform config for editing (convert arrays back to strings for form inputs)
  const getInitialConfig = () => {
    if (!editChannel?.config) return {};
    const config = { ...editChannel.config };

    // Convert recipients array to comma-separated string for email channels
    if (editChannel.type === 'email' && Array.isArray(config.recipients)) {
      config.recipients = config.recipients.join(', ');
    }

    // Convert headers object to JSON string for webhook channels
    if (editChannel.type === 'webhook' && typeof config.headers === 'object') {
      config.headers = JSON.stringify(config.headers, null, 2);
    }

    return config;
  };

  const [formData, setFormData] = useState({
    name: editChannel?.name || '',
    type: editChannel?.type || 'slack',
    config: getInitialConfig(),
    enabled: editChannel?.enabled !== false,
  });

  // Reset form when dialog opens for editing
  useEffect(() => {
    if (open && editChannel) {
      setSelectedType(editChannel.type);
      setFormData({
        name: editChannel.name,
        type: editChannel.type,
        config: getInitialConfig(),
        enabled: editChannel.enabled !== false,
      });
    }
  }, [open, editChannel]);

  const typeConfig = CHANNEL_TYPES[selectedType];

  const handleTypeChange = (type: ChannelType) => {
    setSelectedType(type);
    setFormData((prev) => ({ ...prev, type, config: {} }));
  };

  const handleConfigChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Transform config based on channel type
      let transformedConfig = { ...formData.config };

      if (selectedType === 'email' && typeof transformedConfig.recipients === 'string') {
        // Convert comma-separated string to array of trimmed emails
        transformedConfig.recipients = transformedConfig.recipients
          .split(',')
          .map((email: string) => email.trim())
          .filter((email: string) => email.length > 0);
      }

      if (selectedType === 'webhook' && typeof transformedConfig.headers === 'string') {
        // Parse JSON headers if provided as string
        try {
          transformedConfig.headers = transformedConfig.headers
            ? JSON.parse(transformedConfig.headers)
            : undefined;
        } catch {
          // Keep as undefined if invalid JSON
          transformedConfig.headers = undefined;
        }
      }

      const submitData = { ...formData, config: transformedConfig };
      console.log('[CreateChannelDialog] Submitting:', JSON.stringify(submitData, null, 2));
      await onSubmit(submitData);
      setOpen(false);
      if (!editChannel) {
        setFormData({ name: '', type: 'slack', config: {}, enabled: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editChannel ? (
          <Button variant="outline" size="sm">
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Channel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editChannel ? 'Edit Notification Channel' : 'Create Notification Channel'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Channel Name</Label>
              <Input
                id="name"
                placeholder="e.g., Team Slack Channel"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Channel Type</Label>
              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_TYPES).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{typeConfig.description}</p>
            </div>

            <div className="pt-2 border-t space-y-4">
              <h4 className="font-medium text-sm">Channel Configuration</h4>
              {typeConfig.configFields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={field.name}
                      className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm font-mono"
                      placeholder={field.placeholder}
                      value={formData.config[field.name] || ''}
                      onChange={(e) => handleConfigChange(field.name, e.target.value)}
                      required={field.required}
                    />
                  ) : field.type === 'select' ? (
                    <Select
                      value={formData.config[field.name] || ''}
                      onValueChange={(value) => handleConfigChange(field.name, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formData.config[field.name] || ''}
                      onChange={(e) => handleConfigChange(field.name, e.target.value)}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="enabled" className="font-normal cursor-pointer">
                Enable channel immediately
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : editChannel
                ? 'Update Channel'
                : 'Create Channel'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChannelCard({
  channel,
  onUpdate,
  onDelete,
  onTest,
}: {
  channel: Channel;
  onUpdate: (channelData: Partial<Channel> & { id: string }) => Promise<void>;
  onDelete: (channelId: string) => void;
  onTest: (channelId: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const typeConfig = CHANNEL_TYPES[channel.type];
  const Icon = typeConfig.icon;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(channel.id);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await onTest(channel.id);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{channel.name}</h3>
                <p className="text-sm text-muted-foreground">{typeConfig.label}</p>
              </div>
            </div>
            {!channel.enabled && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-500/10 text-gray-500">
                DISABLED
              </span>
            )}
          </div>

          <div className="pt-3 border-t space-y-1 text-xs">
            {Object.entries(channel.config || {}).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="font-mono truncate">
                  {key.toLowerCase().includes('key') ||
                  key.toLowerCase().includes('token') ||
                  key.toLowerCase().includes('password')
                    ? '••••••••'
                    : String(value)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
              <Send className="h-3 w-3 mr-1" />
              {isTesting ? 'Testing...' : 'Test'}
            </Button>
            <CreateChannelDialog editChannel={channel} onSubmit={(data) => onUpdate({ id: channel.id, ...data })} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Channel"
        description={`Are you sure you want to delete "${channel.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </Card>
  );
}

export function ChannelsPage() {
  const { currentProject } = useProjectStore();
  const { showToast } = useToast();

  const utils = trpc.useUtils();

  // Fetch channels
  const { data: channels, isLoading } = trpc.alerts.listChannels.useQuery({}, {
    enabled: !!currentProject,
  });

  // Mutations
  const createMutation = trpc.alerts.createChannel.useMutation({
    onSuccess: () => {
      utils.alerts.listChannels.invalidate();
    },
  });

  const updateMutation = trpc.alerts.updateChannel.useMutation({
    onSuccess: () => {
      utils.alerts.listChannels.invalidate();
    },
  });

  const deleteMutation = trpc.alerts.deleteChannel.useMutation({
    onSuccess: () => {
      utils.alerts.listChannels.invalidate();
    },
  });

  const testMutation = trpc.alerts.testChannel.useMutation();

  const handleCreate = async (channelData: Partial<Channel>) => {
    await createMutation.mutateAsync(channelData);
  };

  const handleDelete = async (channelId: string) => {
    await deleteMutation.mutateAsync({ id: channelId });
  };

  const handleTest = async (channelId: string) => {
    await testMutation.mutateAsync({ id: channelId });
    showToast('Test notification sent! Check your channel.', 'success');
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view notification channels</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification Channels</h1>
          <p className="text-muted-foreground">
            Configure where alert notifications are sent
          </p>
        </div>
        <CreateChannelDialog onSubmit={handleCreate} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(CHANNEL_TYPES).map(([type, config]) => {
          const Icon = config.icon;
          const count = channels?.filter((c) => c.type === type).length || 0;
          return (
            <Card key={type}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">{config.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-muted rounded" />
                    <div className="flex-1">
                      <div className="h-5 w-32 bg-muted rounded mb-2" />
                      <div className="h-4 w-20 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="flex gap-2">
                    <div className="h-8 w-20 bg-muted rounded" />
                    <div className="h-8 w-20 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !channels || channels.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-2">No channels configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first notification channel to receive alerts
              </p>
              <CreateChannelDialog onSubmit={handleCreate} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onUpdate={async (data) => {
                await updateMutation.mutateAsync(data);
              }}
              onDelete={handleDelete}
              onTest={handleTest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
