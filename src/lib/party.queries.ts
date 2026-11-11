import { queryOptions } from '@tanstack/react-query';
import { getParty } from './party.functions';
export const partyQuery = queryOptions({ queryKey: ['party'], queryFn: () => getParty(), staleTime: 15000 });