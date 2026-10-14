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

/** A two-decimal money string as whole paise, so sums and products stay exact. */
export function toPaise(value: string): number {
	return Math.round(Number(value) * 100);
}

/** Whole paise back to a two-decimal string, the API's money format. */
export function fromPaise(paise: number): string {
	return (paise / 100).toFixed(2);
}

const rupeeCompactFormat = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	notation: 'compact',
	maximumFractionDigits: 1
});
const countCompactFormat = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

/** "₹107.6Cr", "₹1.6L", "₹12K": Indian lakh and crore steps, for tiles and axis ticks. */
export function rupeesCompact(value: string | number): string {
	return rupeeCompactFormat.format(Number(value));
}

/** "2.9L", "39K". */
export function countCompact(value: number): string {
	return countCompactFormat.format(value);
}

/** "17 Jul" for a YYYY-MM-DD day, read as UTC so the day never shifts. */
export function shortDay(day: string): string {
	return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "17 Jul 2026" for a YYYY-MM-DD day, read as UTC. */
export function longDay(day: string): string {
	return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
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
