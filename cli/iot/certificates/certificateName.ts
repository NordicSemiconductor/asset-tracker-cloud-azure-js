/**
 * Ensures certificate names are not too long.
 */
export const certificateName = (name: string): string =>
	name.slice(0, 64).replace(/-$/, '')
