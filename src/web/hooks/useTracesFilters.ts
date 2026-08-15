import { parseAsString, parseAsStringEnum, parseAsBoolean, parseAsInteger, useQueryStates, createSerializer } from 'nuqs';

export const statusOptions = ['UNSET', 'OK', 'ERROR'] as const;
export type StatusCode = typeof statusOptions[number];

export const PAGE_SIZE = 25;

export const tracesFiltersParsers = {
  search: parseAsString.withDefault(''),
  serviceName: parseAsString,
  status: parseAsStringEnum<StatusCode>(statusOptions),
  from: parseAsString,
  to: parseAsString,
  live: parseAsBoolean.withDefault(false),
  page: parseAsInteger.withDefault(1),
};

export function useTracesFilters() {
  return useQueryStates(tracesFiltersParsers, {
    history: 'push',
  });
}

export const serializeTracesFilters = createSerializer(tracesFiltersParsers);
