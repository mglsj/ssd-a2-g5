import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
import DatabaseIcon from '@lucide/svelte/icons/database';
import SearchXIcon from '@lucide/svelte/icons/search-x';
import WalletIcon from '@lucide/svelte/icons/wallet';
import BedDoubleIcon from '@lucide/svelte/icons/bed-double';
import ArrowRightLeftIcon from '@lucide/svelte/icons/arrow-right-left';
import PencilLineIcon from '@lucide/svelte/icons/pencil-line';
import type { Component } from 'svelte';

export const ERROR_CODES = [
	'BAD_REQUEST',
	'NOT_FOUND',
	'INVALID_INPUT',
	'INVALID_TRANSITION',
	'INSUFFICIENT_BALANCE',
	'ALREADY_CHECKED_IN',
	'DB_UNAVAILABLE',
	'INTERNAL'
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type Issue = { path: string; message: string };

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: ErrorCode,
		message: string,
		readonly detail: Record<string, unknown> = {}
	) {
		super(message);
		this.name = 'ApiError';
	}

	/** Builds an ApiError from a failed response body, whatever shape it has. */
	static from(status: number, body: unknown): ApiError {
		const error = (body as { error?: { code?: string; message?: string; detail?: Record<string, unknown> } })
			?.error;
		const code = ERROR_CODES.includes(error?.code as ErrorCode)
			? (error!.code as ErrorCode)
			: status === 503
				? 'DB_UNAVAILABLE'
				: 'INTERNAL';
		return new ApiError(status, code, error?.message ?? `Request failed with status ${status}`, error?.detail);
	}

	/** Field issues from a BAD_REQUEST, keyed by path. */
	get issues(): Record<string, string> {
		const issues = (this.detail.issues as Issue[] | undefined) ?? [];
		return Object.fromEntries(issues.map((issue) => [issue.path, issue.message]));
	}
}

/** Narrows anything thrown by a query or mutation to an ApiError. */
export function toApiError(error: unknown): ApiError {
	if (error instanceof ApiError) return error;
	return new ApiError(0, 'INTERNAL', error instanceof Error ? error.message : String(error));
}

/** A title, icon and plain-language explanation for each error code. */
export const errorInfo: Record<ErrorCode, { title: string; icon: Component; text: string }> = {
	INSUFFICIENT_BALANCE: {
		title: 'Not enough in the wallet',
		icon: WalletIcon,
		text: 'The wallet does not hold enough for this. Top it up and try again.'
	},
	ALREADY_CHECKED_IN: {
		title: 'Guest is already checked in',
		icon: BedDoubleIcon,
		text: 'This guest is checked in to another stay. Complete that stay first.'
	},
	INVALID_TRANSITION: {
		title: 'That status change is not allowed',
		icon: ArrowRightLeftIcon,
		text: 'A stay goes from confirmed to checked in to completed, one step at a time.'
	},
	NOT_FOUND: { title: 'Not found', icon: SearchXIcon, text: 'It may have been removed, or the link is out of date.' },
	BAD_REQUEST: { title: 'Check the details', icon: PencilLineIcon, text: 'Some details are not valid. Check them and try again.' },
	INVALID_INPUT: { title: 'Check the details', icon: PencilLineIcon, text: 'Some details are not valid. Check them and try again.' },
	DB_UNAVAILABLE: {
		title: 'Service unavailable',
		icon: DatabaseIcon,
		text: 'Part of StaySpot is not responding. Try again in a moment.'
	},
	INTERNAL: { title: 'Something went wrong', icon: CircleAlertIcon, text: 'Something went wrong on our side. Try again in a moment.' }
};

/** The title and icon for an error. The /api proxy marks an unreachable API with detail.service. */
export function describeError(error: ApiError): { title: string; icon: Component } {
	if (error.code === 'DB_UNAVAILABLE' && error.detail.service === 'api') {
		return { title: 'StaySpot is unavailable', icon: errorInfo.DB_UNAVAILABLE.icon };
	}
	return errorInfo[error.code];
}

/** The text to show for an error. The API's own messages are written for developers, not for people using the app. */
export function userMessage(error: unknown): string {
	const apiError = toApiError(error);
	if (apiError.code === 'DB_UNAVAILABLE' && apiError.detail.service === 'api') {
		return 'StaySpot is not responding. Try again in a moment.';
	}
	return errorInfo[apiError.code].text;
}

/** Errors worth retrying automatically. A 4xx will fail the same way again. */
export function isRetryable(error: unknown): boolean {
	const status = error instanceof ApiError ? error.status : 0;
	return status === 0 || status >= 500;
}
