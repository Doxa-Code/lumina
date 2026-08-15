import React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Filter, X } from 'lucide-react';
import { useTracesFilters, statusOptions, StatusCode } from '../../hooks/useTracesFilters';
import { trpc } from '../../lib/trpc';
import { useProjectStore } from '../../stores/projectStore';

export function TracesFilters() {
  const { currentProject } = useProjectStore();
  const [filters, setFilters] = useTracesFilters();

  const { data: services } = trpc.traces.services.useQuery(
    {},
    { enabled: !!currentProject }
  );

  const activeFilterCount = [
    filters.serviceName,
    filters.status,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilters({
      serviceName: null,
      status: null,
      page: 1,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Filters</h4>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Service
            </Label>
            <Select
              value={filters.serviceName ?? ''}
              onValueChange={(value) =>
                setFilters({ serviceName: value || null, page: 1 })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All services</SelectItem>
                {services?.map((service) => (
                  <SelectItem key={service.serviceName} value={service.serviceName}>
                    {service.serviceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </Label>
            <Select
              value={filters.status ?? ''}
              onValueChange={(value) =>
                setFilters({ status: (value as StatusCode) || null, page: 1 })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
