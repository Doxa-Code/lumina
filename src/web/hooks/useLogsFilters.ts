import { parseAsString, parseAsBoolean, parseAsInteger, useQueryStates, createSerializer } from 'nuqs';

export const severityOptions = [
  { label: 'All', value: undefined },
  { label: 'Error', value: 17 },
  { label: 'Warn', value: 13 },
  { label: 'Info', value: 9 },
  { label: 'Debug', value: 5 },
] as const;

export const PAGE_SIZE = 100;

export const logsFiltersParsers = {
  search: parseAsString.withDefault(''),
  serviceName: parseAsString,
  severity: parseAsInteger,
  live: parseAsBoolean.withDefault(false),
};

export function useLogsFilters() {
  return useQueryStates(logsFiltersParsers, {
    history: 'push',
  });
}

export const serializeLogsFilters = createSerializer(logsFiltersParsers);
