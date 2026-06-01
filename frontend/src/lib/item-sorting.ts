type ClaimableItem = {
	name: string;
	updatedAt: string;
	claimed: boolean;
};

function updatedAtMs(updatedAt: string): number {
	const parsed = Date.parse(updatedAt);
	return Number.isNaN(parsed) ? 0 : parsed;
}

// Sorts unclaimed items before claimed, and makes the most recently 
// updated item be closer to the middle, reducing the animation distance
export function sortByClaimedAndUpdatedAt<T extends ClaimableItem>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;

		const aMs = updatedAtMs(a.updatedAt);
		const bMs = updatedAtMs(b.updatedAt);

		if (!a.claimed) {
			if (aMs !== bMs) return aMs - bMs;
		} else {
			if (aMs !== bMs) return bMs - aMs;
		}

		return a.name.localeCompare(b.name, 'no');
	});
}
