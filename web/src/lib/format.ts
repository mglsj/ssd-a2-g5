const rupeeFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const rupeeWholeFormat = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	maximumFractionDigits: 0
});
const numberFormat = new Intl.NumberFormat('en-IN');
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const relativeFormat = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

/** Money arrives as a two-decimal string. Display only, never send the result back. */
export function rupees(value: string | number, { whole = false } = {}): string {
	const amount = typeof value === 'number' ? value : Number(value);
	return (whole ? rupeeWholeFormat : rupeeFormat).format(amount);
}

export function count(value: number): string {
	return numberFormat.format(value);
}

/** A UTC timestamp or YYYY-MM-DD date, shown in the viewer's time zone. */
export function date(value: string | Date): string {
	return dateFormat.format(new Date(value));
}

export function dateTime(value: string | Date): string {
	return dateTimeFormat.format(new Date(value));
}

/** "5 min ago", "in 2 days". */
export function relative(value: string | Date, now = Date.now()): string {
	const seconds = Math.round((new Date(value).getTime() - now) / 1000);
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['day', 86_400],
		['hour', 3_600],
		['minute', 60]
	];
	for (const [unit, size] of units) {
		if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
	}
	return relativeFormat.format(seconds, 'second');
}

export function distance(meters: number): string {
	return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** A Date as the UTC YYYY-MM-DD the API expects. */
export function isoDate(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export const statusLabel = {
	CONFIRMED: 'Confirmed',
	CHECKED_IN: 'Checked in',
	COMPLETED: 'Completed'
} as const;

export type BookingStatus = keyof typeof statusLabel;
