import { Link } from 'react-router-dom';
import { Shield, Key, Lock, Globe, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useProjectStore } from '../../stores/projectStore';

interface SecuritySetting {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: typeof Shield;
}

export function SecurityPage() {
  const { currentProject } = useProjectStore();

  const securitySettings: SecuritySetting[] = [
    {
      id: 'https-only',
      name: 'HTTPS Only',
      description: 'All data is transmitted over encrypted HTTPS connections',
      enabled: true,
      icon: Lock,
    },
    {
      id: 'api-key-auth',
      name: 'API Key Authentication',
      description: 'All ingestion endpoints require valid API keys',
      enabled: true,
      icon: Key,
    },
    {
      id: 'data-encryption',
      name: 'Data Encryption at Rest',
      description: 'All stored data is encrypted using AES-256',
      enabled: true,
      icon: Shield,
    },
  ];

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view security settings</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Security
        </h1>
        <p className="text-muted-foreground">
          Security settings and compliance for {currentProject.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security Status</CardTitle>
          <CardDescription>
            Current security configuration for your project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {securitySettings.map((setting) => (
              <div
                key={setting.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-green-500/10">
                    <setting.icon className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">{setting.name}</p>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Enabled</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Access Control
          </CardTitle>
          <CardDescription>
            IP restrictions and access policies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">IP Allowlist</p>
                <p className="text-sm text-muted-foreground">
                  Restrict API access to specific IP addresses
                </p>
              </div>
              <span className="text-sm text-muted-foreground">Coming soon</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Rate Limiting</p>
                <p className="text-sm text-muted-foreground">
                  Configure request rate limits per API key
                </p>
              </div>
              <span className="text-sm text-muted-foreground">Coming soon</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Audit Logs</p>
                <p className="text-sm text-muted-foreground">
                  Track all administrative actions
                </p>
              </div>
              <span className="text-sm text-muted-foreground">Coming soon</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
          <CardDescription>
            Data handling and compliance information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Data Processing</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• All data is processed and stored securely</li>
                <li>• Data is automatically deleted after the retention period</li>
                <li>• No data is shared with third parties</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Data Location</h4>
              <p className="text-sm text-muted-foreground">
                Your data is stored in the region where your instance is deployed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
