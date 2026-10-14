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

export const errorInfo: Record<ErrorCode, { title: string; icon: Component }> = {
	INSUFFICIENT_BALANCE: { title: 'Not enough in the wallet', icon: WalletIcon },
	ALREADY_CHECKED_IN: { title: 'Guest is already checked in', icon: BedDoubleIcon },
	INVALID_TRANSITION: { title: 'That status change is not allowed', icon: ArrowRightLeftIcon },
	NOT_FOUND: { title: 'Not found', icon: SearchXIcon },
	BAD_REQUEST: { title: 'Check the form', icon: PencilLineIcon },
	INVALID_INPUT: { title: 'Check the form', icon: PencilLineIcon },
	DB_UNAVAILABLE: { title: 'A database is down', icon: DatabaseIcon },
	INTERNAL: { title: 'Something went wrong', icon: CircleAlertIcon }
};

/** The title and icon for an error. The /api proxy marks an unreachable API with detail.service. */
export function describeError(error: ApiError): { title: string; icon: Component } {
	if (error.code === 'DB_UNAVAILABLE' && error.detail.service === 'api') {
		return { title: 'The API is down', icon: errorInfo.DB_UNAVAILABLE.icon };
	}
	return errorInfo[error.code];
}

/** Errors worth retrying automatically. A 4xx will fail the same way again. */
export function isRetryable(error: unknown): boolean {
	const status = error instanceof ApiError ? error.status : 0;
	return status === 0 || status >= 500;
}
