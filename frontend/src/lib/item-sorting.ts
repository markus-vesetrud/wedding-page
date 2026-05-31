import type { Item } from '$lib/types';

function updatedAtMs(updatedAt: string): number {
	const parsed = Date.parse(updatedAt);
	return Number.isNaN(parsed) ? 0 : parsed;
}

// Sorts unchecked items before checked, and makes the most recently 
// updated item be closer to the middle, reducing the animation distance
export function sortByCheckedAndUpdatedAt<T extends Item>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		if (a.checked !== b.checked) return a.checked ? 1 : -1;

		const aMs = updatedAtMs(a.updatedAt);
		const bMs = updatedAtMs(b.updatedAt);

		if (!a.checked) {
			if (aMs !== bMs) return aMs - bMs;
		} else {
			if (aMs !== bMs) return bMs - aMs;
		}

		return a.name.localeCompare(b.name, 'no');
	});
}
