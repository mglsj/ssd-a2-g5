import ActivityIcon from '@lucide/svelte/icons/activity';
import FlameIcon from '@lucide/svelte/icons/flame';
import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
import WavesIcon from '@lucide/svelte/icons/waves';
import type { Component } from 'svelte';

export type HotspotStatus = 'CRITICAL_SURGE' | 'HIGH_DEMAND' | 'MODERATE_DEMAND' | 'LOW_ACTIVITY';

/**
 * How each $geoNear hotspot status reads. Status always carries a word and an icon;
 * the colour token only backs them up on the map and in the list.
 */
export const hotspotStatus: Record<HotspotStatus, { label: string; icon: Component; token: string }> = {
	CRITICAL_SURGE: { label: 'Critical surge', icon: FlameIcon, token: '--destructive' },
	HIGH_DEMAND: { label: 'High demand', icon: TrendingUpIcon, token: '--chart-2' },
	MODERATE_DEMAND: { label: 'Moderate demand', icon: WavesIcon, token: '--chart-4' },
	LOW_ACTIVITY: { label: 'Low activity', icon: ActivityIcon, token: '--muted-foreground' }
};
