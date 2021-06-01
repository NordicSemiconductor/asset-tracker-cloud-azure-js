import { Context } from '@azure/functions'

export const log =
	(context: Context) =>
	(...args: any[]): void =>
		context.log(...args.map((arg) => JSON.stringify(arg, null, 2)))
