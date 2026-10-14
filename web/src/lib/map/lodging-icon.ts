// Lucide's bed-double icon (ISC licence), drawn inside a filled circle for the property markers.
const BED_PATHS = [
	'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8',
	'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4',
	'M12 4v6',
	'M2 18h20'
];

/** The marker's size in CSS pixels. */
export const LODGING_ICON_SIZE = 30;

type Colors = { fill: string; icon: string; ring: string };

/**
 * A round property marker: a coloured disc with a white bed and a thin surface ring, so it stays
 * readable where it overlaps pins or other markers. Drawn at the device pixel ratio for sharp edges.
 */
export function createLodgingIcon({ fill, icon, ring }: Colors, pixelRatio = 2): Promise<HTMLImageElement> {
	const size = LODGING_ICON_SIZE * pixelRatio;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 30 30">
		<circle cx="15" cy="15" r="13.5" fill="${fill}" stroke="${ring}" stroke-width="2"/>
		<g transform="translate(7.5 7.5) scale(0.625)" fill="none" stroke="${icon}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
			${BED_PATHS.map((d) => `<path d="${d}"/>`).join('')}
		</g>
	</svg>`;
	return new Promise((resolve, reject) => {
		const image = new Image(size, size);
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Could not draw the property marker'));
		image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	});
}
