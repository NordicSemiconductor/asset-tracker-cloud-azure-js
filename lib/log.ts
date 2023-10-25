import type { InvocationContext } from '@azure/functions'

export const log =
	(context: InvocationContext) =>
	(...args: any[]): void =>
		context.log(...args.map((arg) => JSON.stringify(arg, null, 2)))

export const logError =
	(context: InvocationContext) =>
	(...args: any[]): void =>
		context.error(...args.map((arg) => JSON.stringify(arg, null, 2)))
