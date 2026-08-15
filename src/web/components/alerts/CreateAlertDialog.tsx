import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Info } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: string;
}

interface CreateAlertDialogProps {
  channels?: Channel[];
  onSubmit: (alert: AlertFormData) => void | Promise<void>;
  trigger?: React.ReactNode;
}

export interface AlertFormData {
  name: string;
  description?: string;
  dataSource: 'metric' | 'trace' | 'log' | 'error';
  queryConfig: Record<string, any>;
  conditionType: 'above' | 'below' | 'change_percent' | 'anomaly' | 'absence';
  threshold: { value: number; duration?: string };
  severity: 'info' | 'warning' | 'critical';
  notificationChannelIds: string[];
  enabled: boolean;
}

export function CreateAlertDialog({
  channels = [],
  onSubmit,
  trigger,
}: CreateAlertDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dataSource: 'trace' as const,
    metricName: '',
    serviceName: '',
    conditionType: 'above' as const,
    thresholdValue: 100,
    severity: 'warning' as const,
    channelId: '',
    enabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const alertData: AlertFormData = {
        name: formData.name,
        description: formData.description || undefined,
        dataSource: formData.dataSource,
        queryConfig: {
          metricName: formData.metricName || undefined,
          serviceName: formData.serviceName || undefined,
        },
        conditionType: formData.conditionType,
        threshold: {
          value: formData.thresholdValue,
          duration: '5m',
        },
        severity: formData.severity,
        notificationChannelIds: formData.channelId ? [formData.channelId] : [],
        enabled: formData.enabled,
      };

      await onSubmit(alertData);
      setOpen(false);
      // Reset form
      setFormData({
        name: '',
        description: '',
        dataSource: 'trace',
        metricName: '',
        serviceName: '',
        conditionType: 'above',
        thresholdValue: 100,
        severity: 'warning',
        channelId: '',
        enabled: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Alert
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Alert</DialogTitle>
          <DialogDescription>
            Configure an alert to monitor your telemetry data
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Alert Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Alert Name *</Label>
              <Input
                id="name"
                placeholder="e.g., High Error Rate on API"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of what this alert monitors"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Data Source */}
            <div className="space-y-2">
              <Label htmlFor="dataSource">Data Source *</Label>
              <Select
                value={formData.dataSource}
                onValueChange={(value: any) => setFormData({ ...formData, dataSource: value })}
              >
                <SelectTrigger id="dataSource">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trace">Traces (Latency, Errors)</SelectItem>
                  <SelectItem value="metric">Metrics</SelectItem>
                  <SelectItem value="log">Logs</SelectItem>
                  <SelectItem value="error">Error Groups</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional fields based on data source */}
            {formData.dataSource === 'metric' && (
              <div className="space-y-2">
                <Label htmlFor="metricName">Metric Name</Label>
                <Input
                  id="metricName"
                  placeholder="e.g., http.request.duration"
                  value={formData.metricName}
                  onChange={(e) => setFormData({ ...formData, metricName: e.target.value })}
                />
              </div>
            )}

            {/* Service Name */}
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service (Optional)</Label>
              <Input
                id="serviceName"
                placeholder="e.g., api-gateway"
                value={formData.serviceName}
                onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to monitor all services
              </p>
            </div>

            {/* Condition and Threshold */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="conditionType">Condition *</Label>
                <Select
                  value={formData.conditionType}
                  onValueChange={(value: any) => setFormData({ ...formData, conditionType: value })}
                >
                  <SelectTrigger id="conditionType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Above threshold</SelectItem>
                    <SelectItem value="below">Below threshold</SelectItem>
                    <SelectItem value="change_percent">Change % from baseline</SelectItem>
                    <SelectItem value="anomaly">Anomaly detected</SelectItem>
                    <SelectItem value="absence">Data absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="threshold">
                  {formData.conditionType === 'change_percent' ? 'Change %' : 'Threshold Value'}
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  placeholder="100"
                  value={formData.thresholdValue}
                  onChange={(e) => setFormData({ ...formData, thresholdValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label htmlFor="severity">Severity *</Label>
              <Select
                value={formData.severity}
                onValueChange={(value: any) => setFormData({ ...formData, severity: value })}
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Critical
                    </span>
                  </SelectItem>
                  <SelectItem value="warning">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      Warning
                    </span>
                  </SelectItem>
                  <SelectItem value="info">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Info
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notification Channel */}
            <div className="space-y-2">
              <Label htmlFor="channel">Notification Channel</Label>
              {channels.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>No channels configured. <a href="/alerts/channels" className="text-primary underline">Create one first</a></span>
                </div>
              ) : (
                <Select
                  value={formData.channelId}
                  onValueChange={(value) => setFormData({ ...formData, channelId: value })}
                >
                  <SelectTrigger id="channel">
                    <SelectValue placeholder="Select a channel (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground uppercase">{channel.type}</span>
                          {channel.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Enable immediately */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="enabled" className="font-normal cursor-pointer">
                Enable alert immediately
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
            <Button type="submit" disabled={isSubmitting || !formData.name}>
              {isSubmitting ? 'Creating...' : 'Create Alert'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
