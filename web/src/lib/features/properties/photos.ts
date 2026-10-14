// Stock photos from Unsplash, collected with the Unsplash connector from four searches:
// "hotel room", "apartment interior", "hotel exterior" and "resort pool" (landscape, free
// photos only, no people, no visible hotel names). The data has no real photos, so each
// property gets one of these by its id. They are illustrative, not the actual property.

export type Photo = {
	/** The images.unsplash.com path, for example "photo-1618773928121-c32242e63f39". */
	path: string;
	alt: string;
	author: string;
	username: string;
};

export const PHOTOS: Photo[] = [
	{ path: 'photo-1618773928121-c32242e63f39', alt: 'White bed linen with throw pillows', author: 'Vojtech Bruzek', username: 'vojtechbruzek' },
	{ path: 'photo-1611892440504-42a792e24d32', alt: 'A hotel bedroom with a wooden bed and teal pillows', author: 'visualsofdana', username: 'visualsofdana' },
	{ path: 'photo-1551882547-ff40c63fe5fa', alt: 'A large swimming pool surrounded by palm trees', author: 'Valeriia Bugaiova', username: 'bugaiova_valeriya' },
	{ path: 'photo-1522771739844-6a9f6d5f14af', alt: 'A black table lamp on a nightstand', author: 'Christopher Jolly', username: 'chris_jolly' },
	{ path: 'photo-1596394516093-501ba68a0ba6', alt: 'A wooden chair on a wooden deck', author: 'Patrick Robert Doyle', username: 'teapowered' },
	{ path: 'photo-1512918728675-ed5a9ecdebfd', alt: 'A wooden bed frame with a white cover beside a nightstand', author: 'Frames For Your Heart', username: 'framesforyourheart' },
	{ path: 'photo-1630660664869-c9d3cc676880', alt: 'White pillows on a white bed', author: 'Dave Photoz', username: 'mirapolis' },
	{ path: 'photo-1631049421450-348ccd7f8949', alt: 'White bed linen on a bed', author: 'Point3D Commercial Imaging Ltd.', username: '3dottawa' },
	{ path: 'photo-1595576508898-0ad5c879a061', alt: 'White bed linen on a bed', author: 'Mky Moody', username: 'himashiyan' },
	{ path: 'photo-1445991842772-097fea258e7b', alt: 'Gray and black throw pillows on a bed', author: 'Nik Lanús', username: 'niklanus' },
	{ path: 'photo-1549638441-b787d2e11f14', alt: 'A white bed near a window', author: 'Andrew Neel', username: 'andrewtneel' },
	{ path: 'photo-1590381105924-c72589b9ef3f', alt: 'A wood-panelled hotel room with a bed and lamps', author: 'Rod Long', username: 'rodlong' },
	{ path: 'photo-1587985064135-0366536eab42', alt: 'A bedroom with black and white bed linen', author: 'Isaac Quesada', username: 'isaacquesada' },
	{ path: 'photo-1586105251261-72a756497a11', alt: 'A bedroom with black and white bed linen', author: 'Kam Idris', username: 'ka_idris' },
	{ path: 'photo-1562438668-bcf0ca6578f0', alt: 'A gray bed in a bedroom', author: '刘 强', username: 'iwood' },
	{ path: 'photo-1522708323590-d24dbb6b0267', alt: 'A tidy furnished room', author: 'deborah cortelazzi', username: 'deborah_cortelazzi' },
	{ path: 'photo-1502672260266-1c1ef2d93688', alt: 'A gray loveseat near a wooden table', author: 'Patrick Perkins', username: 'patrickperkins' },
	{ path: 'photo-1560448204-e02f11c3d0e2', alt: 'A beige couch and armchair', author: 'Francesca Tosolini', username: 'fromitaly' },
	{ path: 'photo-1586023492125-27b2c045efd7', alt: 'A wooden chair with a yellow cushion', author: 'Kam Idris', username: 'ka_idris' },
	{ path: 'photo-1484154218962-a197022b5858', alt: 'A modular kitchen with a steel refrigerator', author: 'Naomi Hébert', username: 'naomish' },
	{ path: 'photo-1628592102751-ba83b0314276', alt: 'A modern living room with a television and an armchair', author: 'Huy Nguyen', username: 'huynguyen_pch' },
	{ path: 'photo-1613575831056-0acd5da8f085', alt: 'A sunlit living room with a desk and a sofa', author: 'Med Badr Chemmaoui', username: 'medbadrc' },
	{ path: 'photo-1493809842364-78817add7ffb', alt: 'A living room with a flat screen television', author: 'Jarek Ceborski', username: 'jarson' },
	{ path: 'photo-1665249934445-1de680641f50', alt: 'A living room with a large window', author: 'Danilo Rios', username: 'danrop' },
	{ path: 'photo-1675279200694-8529c73b1fd0', alt: 'A kitchen with a table and chairs next to a window', author: 'Rafael Hoyos Weht', username: 'rhweht' },
	{ path: 'photo-1612320648993-61c1cd604b71', alt: 'A white sink near a wooden table', author: 'Huy Nguyen', username: 'huynguyen_pch' },
	{ path: 'photo-1468824357306-a439d58ccb1c', alt: 'A resort building with a pool', author: 'RKTKN', username: 'rktkn' },
	{ path: 'photo-1607320895054-c5c543e9a069', alt: 'A white building beside a green lawn', author: 'Axel Bimashanda', username: 'axelbimashanda' },
	{ path: 'photo-1661016630713-67e36bfc2285', alt: 'A pool in front of a building', author: 'Vije Vijendranath', username: 'vijev' },
	{ path: 'photo-1472510771109-39b92752a6b9', alt: 'A high-rise building seen from below', author: 'Austin Neill', username: 'arstyy' },
	{ path: 'photo-1623718649591-311775a30c43', alt: 'A swimming pool near palm trees', author: 'Cory Bjork', username: 'corybjork' },
	{ path: 'photo-1610641818989-c2051b5e2cfd', alt: 'Palm trees beside a swimming pool', author: 'Fabio Fistarol', username: 'fabiofistarol' },
	{ path: 'photo-1582719508461-905c673771fd', alt: 'Wooden lounge chairs beside an infinity pool', author: 'Sasha Kaunas', username: 'akaunas' },
	{ path: 'photo-1584132869994-873f9363a562', alt: 'Wooden lounge chairs on a deck', author: 'Sasha Kaunas', username: 'akaunas' },
	{ path: 'photo-1687834618283-1b9e12de54a7', alt: 'A row of lounge chairs next to a swimming pool', author: 'Nathan Mullet', username: 'nate072107' },
	{ path: 'photo-1711114435495-76503f9f3181', alt: 'A large swimming pool next to a house', author: 'Zoshua Colah', username: 'zoshuacolah' },
	{ path: 'photo-1714254571994-60e58b76deb0', alt: 'A large swimming pool surrounded by palm trees', author: 'Nico Smit', username: 'nicosmit99' },
	{ path: 'photo-1711114378532-bab7d55311f3', alt: 'A swimming pool with a lounge chair', author: 'Zoshua Colah', username: 'zoshuacolah' },
	{ path: 'photo-1623812058330-ccfa078cffb3', alt: 'A house beside a swimming pool', author: 'Cory Bjork', username: 'corybjork' },
	{ path: 'photo-1671362962572-50cf4edca731', alt: 'A hotel pool lit up at night', author: 'Jaye Hernandez', username: 'jaye' },
	{ path: 'photo-1669694575282-03ed7faf6360', alt: 'A pool with chairs and umbrellas', author: 'Ruth Bourke', username: 'nocturnecapture' }
];

/** A stable number from a property id, so a property keeps its photo across visits. */
export function hashId(id: string): number {
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return hash;
}

export function photoFor(propertyId: string): Photo {
	return PHOTOS[hashId(propertyId) % PHOTOS.length];
}

/** An Unsplash CDN URL cropped to the given width. Imgix serves WebP or AVIF where supported. */
export function photoUrl(photo: Photo, width: number, height?: number): string {
	const params = new URLSearchParams({ auto: 'format', fit: 'crop', w: String(width), q: '70' });
	if (height) params.set('h', String(height));
	return `https://images.unsplash.com/${photo.path}?${params}`;
}

export function photoSrcset(photo: Photo, widths: number[], ratio: number): string {
	return widths.map((w) => `${photoUrl(photo, w, Math.round(w / ratio))} ${w}w`).join(', ');
}

// Unsplash asks for credit to the photographer and to Unsplash, with these referral parameters.
const REFERRAL = 'utm_source=stayspot&utm_medium=referral';
export const authorUrl = (photo: Photo) => `https://unsplash.com/@${photo.username}?${REFERRAL}`;
export const unsplashUrl = `https://unsplash.com/?${REFERRAL}`;
