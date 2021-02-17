/**
 * Ensures certificate names are not too long.
 */
export const certificateName = (name: string): string =>
	name.substring(0, 64).replace(/-$/, '')
